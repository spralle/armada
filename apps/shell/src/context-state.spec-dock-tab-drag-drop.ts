import type { ShellRuntime } from "./app/types.js";
import {
  createInitialShellContextState,
  registerTab,
  type ShellContextState,
} from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { moveDockTabThroughRuntime, wireDockTabDragDrop } from "./ui/dock-tab-dnd.js";

import { DRAG_INLINE_PREFIX } from "./app/constants.js";

interface DragDataTransfer {
  effectAllowed: string;
  dropEffect: string;
  setData: (format: string, value: string) => void;
  getData: (format: string) => string;
}

type DragListener = (event: DragEvent) => void;

class FakeDockHandle {
  readonly dataset: DOMStringMap;
  private readonly listeners = new Map<string, DragListener[]>();

  constructor(tabId: string) {
    this.dataset = { action: "drag-tab-handle", tabId };
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized = typeof listener === "function"
      ? (listener as DragListener)
      : ((event: DragEvent) => listener.handleEvent(event as unknown as Event));
    const existing = this.listeners.get(type) ?? [];
    existing.push(normalized);
    this.listeners.set(type, existing);
  }

  dispatch(type: "dragstart", event: DragEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

class FakeDockZone {
  readonly dataset: DOMStringMap;
  private readonly listeners = new Map<string, DragListener[]>();

  constructor(targetTabId: string, zone: "left" | "right" | "top" | "bottom" | "center") {
    this.dataset = {
      dockDropZone: zone,
      targetTabId,
    };
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized = typeof listener === "function"
      ? (listener as DragListener)
      : ((event: DragEvent) => listener.handleEvent(event as unknown as Event));
    const existing = this.listeners.get(type) ?? [];
    existing.push(normalized);
    this.listeners.set(type, existing);
  }

  dispatch(type: "dragover" | "drop", event: DragEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

class FakeDockRoot {
  private readonly classes = new Set<string>();
  private readonly attributes = new Map<string, string>();

  readonly classList = {
    add: (className: string) => {
      this.classes.add(className);
    },
    remove: (className: string) => {
      this.classes.delete(className);
    },
    contains: (className: string) => this.classes.has(className),
  };

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  constructor(
    private readonly handles: FakeDockHandle[],
    private readonly zones: FakeDockZone[],
  ) {}

  querySelectorAll<T>(selector: string): T[] {
    if (selector === "[data-action='drag-tab-handle']") {
      return this.handles as unknown as T[];
    }

    if (selector === "[data-dock-drop-zone][data-target-tab-id]") {
      return this.zones as unknown as T[];
    }

    return [];
  }
}

type LocalBridgeEvent = Parameters<ShellRuntime["bridge"]["publish"]>[0];

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
  let prevented = false;
  return {
    dataTransfer: dataTransfer as unknown as DataTransfer,
    preventDefault() {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  } as DragEvent;
}

function createRuntime(): ShellRuntime {
  let state: ShellContextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
  });
  state = registerTab(state, {
    tabId: "tab-b",
    groupId: "group-main",
    closePolicy: "closeable",
  });

  const runtime = {
    windowId: "window-a",
    syncDegraded: false,
    syncDegradedReason: null,
    contextState: state,
    selectedPartId: "tab-a",
    selectedPartTitle: "tab-a",
    pendingFocusSelector: null,
    notice: "",
    bridge: {
      available: false,
      publish(_event: LocalBridgeEvent) {
        return false;
      },
      subscribe() {
        return () => {};
      },
      subscribeHealth() {
        return () => {};
      },
      recover() {},
    },
    contextPersistence: {
      save(nextState: ShellContextState) {
        runtime.contextState = nextState;
        return { warning: null };
      },
    },
  } as unknown as ShellRuntime;

  return runtime;
}

export function registerDockTabDragDropSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;
  const dockMime = "application/x-armada-tab-drag";

  test("dock drag drop moves tab via text/plain fallback payload", () => {
    const runtime = createRuntime();
    const handle = new FakeDockHandle("tab-b");
    const zone = new FakeDockZone("tab-a", "right");
    const root = new FakeDockRoot([handle], [zone]);
    let renderPartsCalls = 0;
    let renderSyncCalls = 0;
    let renderContextCalls = 0;

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {
        renderContextCalls += 1;
      },
      renderParts() {
        renderPartsCalls += 1;
      },
      renderSyncStatus() {
        renderSyncCalls += 1;
      },
    });

    const transfer = new MemoryDataTransfer();
    handle.dispatch("dragstart", createDragEvent(transfer));

    transfer.setData(dockMime, "");
    transfer.setData("text/plain", "tab-b");
    const dropEvent = createDragEvent(transfer);
    zone.dispatch("drop", dropEvent);

    assertEqual(runtime.contextState.activeTabId, "tab-b", "dock drop should activate moved tab");
    assertEqual(renderContextCalls, 1, "dock drop should rerender context controls once");
    assertEqual(renderPartsCalls, 1, "dock drop should rerender parts once");
    assertEqual(renderSyncCalls, 1, "dock drop should rerender sync status once");
  });

  test("dock dragover ignores tab-strip payload prefixes as safe no-op", () => {
    const runtime = createRuntime();
    const handle = new FakeDockHandle("tab-b");
    const zone = new FakeDockZone("tab-a", "left");
    const root = new FakeDockRoot([handle], [zone]);

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {},
      renderParts() {},
      renderSyncStatus() {},
    });

    const transfer = new MemoryDataTransfer();
    transfer.setData("text/plain", `${DRAG_INLINE_PREFIX}{"kind":"shell-tab-dnd"}`);
    const dragoverEvent = createDragEvent(transfer);
    zone.dispatch("dragover", dragoverEvent);

    assertEqual(dragoverEvent.defaultPrevented, false, "tab-strip payloads should not arm dock drop zones");
    assertEqual(transfer.dropEffect, "none", "tab-strip payloads should force dropEffect none");
  });

  test("dock dragover is suppressed while splitter drag is active", () => {
    const runtime = createRuntime();
    const handle = new FakeDockHandle("tab-b");
    const zone = new FakeDockZone("tab-a", "left");
    const root = new FakeDockRoot([handle], [zone]);

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {},
      renderParts() {},
      renderSyncStatus() {},
    });

    root.classList.add("is-dock-dragging");
    root.setAttribute("data-dock-splitter-drag-active", "true");
    const transfer = new MemoryDataTransfer();
    transfer.setData(dockMime, JSON.stringify({ tabId: "tab-b", sourceWindowId: "window-a" }));
    const dragoverEvent = createDragEvent(transfer);
    zone.dispatch("dragover", dragoverEvent);

    assertEqual(dragoverEvent.defaultPrevented, false, "splitter-active dragover should not arm dock zones");
    assertEqual(transfer.dropEffect, "none", "splitter-active dragover should force dropEffect none");
    assertEqual(root.classList.contains("is-dock-dragging"), false, "splitter-active dragover should clear dock dragging class");
  });

  test("dock drop is ignored while splitter drag is active", () => {
    const runtime = createRuntime();
    const handle = new FakeDockHandle("tab-b");
    const zone = new FakeDockZone("tab-a", "bottom");
    const root = new FakeDockRoot([handle], [zone]);

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {},
      renderParts() {},
      renderSyncStatus() {},
    });

    const beforeActive = runtime.contextState.activeTabId;
    root.classList.add("is-dock-dragging");
    root.setAttribute("data-dock-splitter-drag-active", "true");
    const transfer = new MemoryDataTransfer();
    transfer.setData(dockMime, JSON.stringify({ tabId: "tab-b", sourceWindowId: "window-a" }));
    const dropEvent = createDragEvent(transfer);
    zone.dispatch("drop", dropEvent);

    assertEqual(dropEvent.defaultPrevented, true, "splitter-active drop should prevent default and short-circuit");
    assertEqual(runtime.contextState.activeTabId, beforeActive, "splitter-active drop should not move tabs");
    assertEqual(root.classList.contains("is-dock-dragging"), false, "splitter-active drop should clear dock dragging class");
  });

  test("dock move remains local when bridge unavailable", () => {
    const runtime = createRuntime();
    const handle = new FakeDockHandle("tab-b");
    const zone = new FakeDockZone("tab-a", "center");
    const root = new FakeDockRoot([handle], [zone]);
    let renderPartsCalls = 0;

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {},
      renderParts() {
        renderPartsCalls += 1;
      },
      renderSyncStatus() {},
    });

    const transfer = new MemoryDataTransfer();
    handle.dispatch("dragstart", createDragEvent(transfer));

    transfer.setData(dockMime, "");
    transfer.setData("text/plain", "tab-b");
    zone.dispatch("drop", createDragEvent(transfer));

    assertEqual(runtime.contextState.activeTabId, "tab-b", "local dock move should still activate tab");
    assertEqual(renderPartsCalls, 1, "local dock move should still rerender parts");
  });

  test("dock drop blocks explicit cross-window payloads", () => {
    const runtime = createRuntime();
    const handle = new FakeDockHandle("tab-b");
    const zone = new FakeDockZone("tab-a", "top");
    const root = new FakeDockRoot([handle], [zone]);
    let renderPartsCalls = 0;
    const beforeActive = runtime.contextState.activeTabId;

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {},
      renderParts() {
        renderPartsCalls += 1;
      },
      renderSyncStatus() {},
    });

    const transfer = new MemoryDataTransfer();
    transfer.setData(dockMime, JSON.stringify({ tabId: "tab-b", sourceWindowId: "window-b" }));
    zone.dispatch("drop", createDragEvent(transfer));

    assertEqual(runtime.contextState.activeTabId, beforeActive, "cross-window dock payload should be ignored");
    assertEqual(renderPartsCalls, 0, "cross-window dock payload should not trigger rerender");
  });

  test("degraded mode still permits same-window dock moves", () => {
    const runtime = createRuntime();
    runtime.syncDegraded = true;
    runtime.syncDegradedReason = "publish-failed";
    const handle = new FakeDockHandle("tab-b");
    const zone = new FakeDockZone("tab-a", "bottom");
    const root = new FakeDockRoot([handle], [zone]);
    let renderPartsCalls = 0;

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {},
      renderParts() {
        renderPartsCalls += 1;
      },
      renderSyncStatus() {},
    });

    const transfer = new MemoryDataTransfer();
    handle.dispatch("dragstart", createDragEvent(transfer));
    transfer.setData(dockMime, "");
    transfer.setData("text/plain", "tab-b");
    zone.dispatch("drop", createDragEvent(transfer));

    assertEqual(runtime.contextState.activeTabId, "tab-b", "degraded mode should still apply same-window dock move");
    assertEqual(renderPartsCalls, 1, "degraded mode same-window move should rerender parts");
  });

  test("moveDockTabThroughRuntime permits same-window move while degraded", () => {
    const runtime = createRuntime();
    runtime.syncDegraded = true;
    runtime.syncDegradedReason = "publish-failed";
    let renderPartsCalls = 0;
    let renderSyncCalls = 0;

    const moved = moveDockTabThroughRuntime(runtime, {
      renderContextControls() {},
      renderParts() {
        renderPartsCalls += 1;
      },
      renderSyncStatus() {
        renderSyncCalls += 1;
      },
    }, {
      tabId: "tab-b",
      sourceWindowId: "window-a",
      targetTabId: "tab-a",
      zone: "left",
    });

    assertEqual(moved, true, "same-window dock move should not be blocked by degraded mode");
    assertEqual(runtime.contextState.activeTabId, "tab-b", "same-window move should still activate moved tab");
    assertEqual(renderPartsCalls, 1, "same-window move should rerender parts");
    assertEqual(renderSyncCalls, 1, "same-window move should rerender sync status");
  });
}
