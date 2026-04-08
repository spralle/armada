import { DRAG_INLINE_PREFIX } from "./app/constants.js";
import type { ShellRuntime } from "./app/types.js";
import {
  createInitialShellContextState,
  registerTab,
  type ShellContextState,
} from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { wireTabStripDragDrop } from "./ui/tab-drag-drop.js";

interface DragDataTransfer {
  effectAllowed: string;
  dropEffect: string;
  setData: (format: string, value: string) => void;
  getData: (format: string) => string;
  setDragImage: (image: Element, x: number, y: number) => void;
}

type DragListener = (event: DragEvent) => void;

class FakeTabButton {
  readonly dataset: DOMStringMap;
  private readonly listeners = new Map<string, DragListener[]>();

  constructor(tabId: string) {
    this.dataset = { partId: tabId };
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized = typeof listener === "function"
      ? (listener as DragListener)
      : ((event: DragEvent) => listener.handleEvent(event as unknown as Event));
    const existing = this.listeners.get(type) ?? [];
    existing.push(normalized);
    this.listeners.set(type, existing);
  }
}

class FakeTabItem {
  readonly dataset: DOMStringMap;
  draggable = false;
  private readonly listeners = new Map<string, DragListener[]>();

  constructor(tabId: string, private readonly tabButton: FakeTabButton) {
    this.dataset = { tabItem: tabId };
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized = typeof listener === "function"
      ? (listener as DragListener)
      : ((event: DragEvent) => listener.handleEvent(event as unknown as Event));
    const existing = this.listeners.get(type) ?? [];
    existing.push(normalized);
    this.listeners.set(type, existing);
  }

  querySelector<T>(selector: string): T | null {
    if (selector === "button[data-action='activate-tab']") {
      return this.tabButton as unknown as T;
    }
    return null;
  }

  dispatch(type: "dragstart" | "drop", event: DragEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

class FakeRoot {
  private readonly classes = new Set<string>();

  readonly classList = {
    add: (className: string) => {
      this.classes.add(className);
    },
    remove: (className: string) => {
      this.classes.delete(className);
    },
    contains: (className: string) => this.classes.has(className),
  };

  constructor(private readonly tabItems: FakeTabItem[]) {}

  querySelectorAll<T>(selector: string): T[] {
    if (selector === "[data-tab-item]") {
      return this.tabItems as unknown as T[];
    }
    return [];
  }
}

class MemoryDataTransfer implements DragDataTransfer {
  effectAllowed = "none";
  dropEffect = "none";
  private readonly data = new Map<string, string>();

  setData(format: string, value: string): void {
    this.data.set(format, value);
  }

  getData(format: string): string {
    return this.data.get(format) ?? "";
  }

  setDragImage(_image: Element, _x: number, _y: number): void {}
}

class EmptyReadDataTransfer extends MemoryDataTransfer {
  override getData(_format: string): string {
    return "";
  }
}

function createDragEvent(dataTransfer: DragDataTransfer, target?: EventTarget): DragEvent {
  return {
    dataTransfer: dataTransfer as unknown as DataTransfer,
    target: target ?? null,
    preventDefault() {},
    stopPropagation() {},
  } as DragEvent;
}

function createRuntime(): ShellRuntime {
  let state: ShellContextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
  });
  state = registerTab(state, { tabId: "tab-b", groupId: "group-main" });
  state = registerTab(state, { tabId: "tab-c", groupId: "group-main" });

  const runtime = {
    windowId: "window-a",
    syncDegraded: false,
    contextState: state,
    notice: "",
    dragSessionBroker: {
      available: false,
      create: () => ({ id: "unused" }),
      consume: () => null,
    },
    contextPersistence: {
      save() {
        return { warning: null };
      },
    },
  } as unknown as ShellRuntime;

  return runtime;
}

function createTabHarness(tabIds: string[]): {
  root: FakeRoot;
  tabButtons: Map<string, FakeTabButton>;
  tabItems: Map<string, FakeTabItem>;
} {
  const tabButtons = new Map<string, FakeTabButton>();
  const tabItems = new Map<string, FakeTabItem>();
  const items: FakeTabItem[] = [];

  for (const tabId of tabIds) {
    const button = new FakeTabButton(tabId);
    const item = new FakeTabItem(tabId, button);
    tabButtons.set(tabId, button);
    tabItems.set(tabId, item);
    items.push(item);
  }

  return {
    root: new FakeRoot(items),
    tabButtons,
    tabItems,
  };
}

export function registerTabDragDropSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("same-window tab drop reorders and activates dragged tab", () => {
    const runtime = createRuntime();
    const tabHarness = createTabHarness(["tab-a", "tab-b", "tab-c"]);
    const moved: string[] = [];
    wireTabStripDragDrop(tabHarness.root as unknown as HTMLElement, runtime, (tabId) => {
      moved.push(tabId);
    });

    const dragTransfer = new MemoryDataTransfer();
    tabHarness.tabItems.get("tab-c")!.dispatch(
      "dragstart",
      createDragEvent(dragTransfer, tabHarness.tabButtons.get("tab-c") as unknown as EventTarget),
    );
    tabHarness.tabItems.get("tab-b")!.dispatch("drop", createDragEvent(dragTransfer));

    assertEqual(runtime.contextState.tabOrder.join(","), "tab-a,tab-c,tab-b", "drop should deterministically reorder tab order");
    assertEqual(runtime.contextState.activeTabId, "tab-c", "drop should activate moved tab");
    assertEqual(moved.join(","), "tab-c", "drop callback should run for moved tab");
  });

  test("malformed drag payload is ignored as safe no-op", () => {
    const runtime = createRuntime();
    const before = runtime.contextState;
    const tabHarness = createTabHarness(["tab-a", "tab-b", "tab-c"]);
    const moved: string[] = [];
    wireTabStripDragDrop(tabHarness.root as unknown as HTMLElement, runtime, (tabId) => {
      moved.push(tabId);
    });

    const transfer = new MemoryDataTransfer();
    transfer.setData("text/plain", `${DRAG_INLINE_PREFIX}{\"kind\":\"invalid\"}`);
    tabHarness.tabItems.get("tab-b")!.dispatch("drop", createDragEvent(transfer));

    assertEqual(runtime.contextState, before, "invalid payload should not mutate context state");
    assertEqual(moved.length, 0, "invalid payload should not trigger move callback");
  });

  test("cross-window payload is blocked as no-op", () => {
    const runtime = createRuntime();
    const before = runtime.contextState;
    const tabHarness = createTabHarness(["tab-a", "tab-b", "tab-c"]);
    const moved: string[] = [];
    wireTabStripDragDrop(tabHarness.root as unknown as HTMLElement, runtime, (tabId) => {
      moved.push(tabId);
    });

    const transfer = new MemoryDataTransfer();
    transfer.setData(
      "text/plain",
      `${DRAG_INLINE_PREFIX}{\"kind\":\"shell-tab-dnd\",\"tabId\":\"tab-c\",\"sourceWindowId\":\"window-b\"}`,
    );
    tabHarness.tabItems.get("tab-b")!.dispatch("drop", createDragEvent(transfer));

    assertEqual(runtime.contextState, before, "cross-window payload should not mutate context state");
    assertEqual(moved.length, 0, "cross-window payload should not trigger move callback");
  });

  test("tab drop reorders using dock MIME payload fallback", () => {
    const runtime = createRuntime();
    const tabHarness = createTabHarness(["tab-a", "tab-b", "tab-c"]);
    const moved: string[] = [];
    wireTabStripDragDrop(tabHarness.root as unknown as HTMLElement, runtime, (tabId) => {
      moved.push(tabId);
    });

    const transfer = new MemoryDataTransfer();
    transfer.setData("application/x-armada-tab-drag", JSON.stringify({ tabId: "tab-c", sourceWindowId: "window-a" }));
    tabHarness.tabItems.get("tab-b")!.dispatch("drop", createDragEvent(transfer));

    assertEqual(runtime.contextState.tabOrder.join(","), "tab-a,tab-c,tab-b", "dock MIME fallback should reorder tabs");
    assertEqual(runtime.contextState.activeTabId, "tab-c", "dock MIME fallback should activate dragged tab");
    assertEqual(moved.join(","), "tab-c", "dock MIME fallback should trigger move callback");
  });

  test("tab drop reorders using active drag payload fallback when reads are empty", () => {
    const runtime = createRuntime();
    const tabHarness = createTabHarness(["tab-a", "tab-b", "tab-c"]);
    const moved: string[] = [];
    wireTabStripDragDrop(tabHarness.root as unknown as HTMLElement, runtime, (tabId) => {
      moved.push(tabId);
    });

    const dragStartTransfer = new MemoryDataTransfer();
    tabHarness.tabItems.get("tab-c")!.dispatch(
      "dragstart",
      createDragEvent(dragStartTransfer, tabHarness.tabButtons.get("tab-c") as unknown as EventTarget),
    );

    const emptyReadTransfer = new EmptyReadDataTransfer();
    tabHarness.tabItems.get("tab-b")!.dispatch("drop", createDragEvent(emptyReadTransfer));

    assertEqual(runtime.contextState.tabOrder.join(","), "tab-a,tab-c,tab-b", "active payload fallback should reorder tabs");
    assertEqual(runtime.contextState.activeTabId, "tab-c", "active payload fallback should activate dragged tab");
    assertEqual(moved.join(","), "tab-c", "active payload fallback should trigger move callback");
  });
}
