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
}

type DragListener = (event: DragEvent) => void;

class FakeTabButton {
  readonly dataset: DOMStringMap;
  draggable = false;
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

  constructor(private readonly tabButtons: FakeTabButton[]) {}

  querySelectorAll<T>(_selector: string): T[] {
    return this.tabButtons as unknown as T[];
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
}

function createDragEvent(dataTransfer: DragDataTransfer): DragEvent {
  return {
    dataTransfer: dataTransfer as unknown as DataTransfer,
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

export function registerTabDragDropSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("same-window tab drop reorders and activates dragged tab", () => {
    const runtime = createRuntime();
    const buttons = [new FakeTabButton("tab-a"), new FakeTabButton("tab-b"), new FakeTabButton("tab-c")];
    const root = new FakeRoot(buttons);
    const moved: string[] = [];
    wireTabStripDragDrop(root as unknown as HTMLElement, runtime, (tabId) => {
      moved.push(tabId);
    });

    const dragTransfer = new MemoryDataTransfer();
    buttons[2]!.dispatch("dragstart", createDragEvent(dragTransfer));
    buttons[1]!.dispatch("drop", createDragEvent(dragTransfer));

    assertEqual(runtime.contextState.tabOrder.join(","), "tab-a,tab-c,tab-b", "drop should deterministically reorder tab order");
    assertEqual(runtime.contextState.activeTabId, "tab-c", "drop should activate moved tab");
    assertEqual(moved.join(","), "tab-c", "drop callback should run for moved tab");
  });

  test("malformed drag payload is ignored as safe no-op", () => {
    const runtime = createRuntime();
    const before = runtime.contextState;
    const buttons = [new FakeTabButton("tab-a"), new FakeTabButton("tab-b"), new FakeTabButton("tab-c")];
    const root = new FakeRoot(buttons);
    const moved: string[] = [];
    wireTabStripDragDrop(root as unknown as HTMLElement, runtime, (tabId) => {
      moved.push(tabId);
    });

    const transfer = new MemoryDataTransfer();
    transfer.setData("text/plain", `${DRAG_INLINE_PREFIX}{\"kind\":\"invalid\"}`);
    buttons[1]!.dispatch("drop", createDragEvent(transfer));

    assertEqual(runtime.contextState, before, "invalid payload should not mutate context state");
    assertEqual(moved.length, 0, "invalid payload should not trigger move callback");
  });

  test("cross-window payload is blocked as no-op", () => {
    const runtime = createRuntime();
    const before = runtime.contextState;
    const buttons = [new FakeTabButton("tab-a"), new FakeTabButton("tab-b"), new FakeTabButton("tab-c")];
    const root = new FakeRoot(buttons);
    const moved: string[] = [];
    wireTabStripDragDrop(root as unknown as HTMLElement, runtime, (tabId) => {
      moved.push(tabId);
    });

    const transfer = new MemoryDataTransfer();
    transfer.setData(
      "text/plain",
      `${DRAG_INLINE_PREFIX}{\"kind\":\"shell-tab-dnd\",\"tabId\":\"tab-c\",\"sourceWindowId\":\"window-b\"}`,
    );
    buttons[1]!.dispatch("drop", createDragEvent(transfer));

    assertEqual(runtime.contextState, before, "cross-window payload should not mutate context state");
    assertEqual(moved.length, 0, "cross-window payload should not trigger move callback");
  });
}
