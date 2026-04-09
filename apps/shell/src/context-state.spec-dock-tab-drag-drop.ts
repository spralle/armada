import type { ShellRuntime } from "./app/types.js";
import {
  createInitialShellContextState,
  registerTab,
  type ShellContextState,
} from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { moveDockTabThroughRuntime, wireDockTabDragDrop } from "./ui/dock-tab-dnd.js";
import { setActiveDockDragPayload } from "./ui/dock-drag-session.js";

import { DRAG_INLINE_PREFIX, TAB_DOCK_DRAG_MIME } from "./app/constants.js";

interface DragDataTransfer {
  effectAllowed: string;
  dropEffect: string;
  setData: (format: string, value: string) => void;
  getData: (format: string) => string;
}

type DragListener = (event: DragEvent) => void;

class FakeOverlay {
  readonly classList = {
    add: (_className: string) => {},
    remove: (_className: string) => {},
  };

  contains(target: unknown): boolean {
    return target instanceof FakeDockZone;
  }
}

class FakeDockZone {
  readonly dataset: DOMStringMap;
  private readonly listeners = new Map<string, DragListener[]>();
  private readonly overlay: FakeOverlay;

  constructor(targetTabId: string, zone: "left" | "right" | "top" | "bottom" | "center", overlay: FakeOverlay) {
    this.dataset = {
      dockDropZone: zone,
      targetTabId,
    };
    this.overlay = overlay;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized = typeof listener === "function"
      ? (listener as DragListener)
      : ((event: DragEvent) => listener.handleEvent(event as unknown as Event));
    const existing = this.listeners.get(type) ?? [];
    existing.push(normalized);
    this.listeners.set(type, existing);
  }

  dispatch(type: "dragover" | "dragleave" | "drop", event: DragEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  closest(selector: string): FakeOverlay | null {
    if (selector === ".dock-drop-overlay") {
      return this.overlay;
    }

    return null;
  }
}

class FakeDockRoot {
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

  private readonly listeners = new Map<string, DragListener[]>();

  constructor(
    private readonly zones: FakeDockZone[],
  ) {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized = typeof listener === "function"
      ? (listener as DragListener)
      : ((event: DragEvent) => listener.handleEvent(event as unknown as Event));
    const existing = this.listeners.get(type) ?? [];
    existing.push(normalized);
    this.listeners.set(type, existing);
  }

  querySelectorAll<T>(selector: string): T[] {
    if (selector === "[data-dock-drop-zone][data-target-tab-id]") {
      return this.zones as unknown as T[];
    }

    return [];
  }

  dispatch(type: "dragend" | "drop", event: DragEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
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

class EmptyReadDataTransfer extends MemoryDataTransfer {
  override getData(_format: string): string {
    return "";
  }
}

function createDragEvent(dataTransfer: DragDataTransfer): DragEvent {
  let prevented = false;
  return {
    dataTransfer: dataTransfer as unknown as DataTransfer,
    relatedTarget: null,
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {},
    get defaultPrevented() {
      return prevented;
    },
  } as DragEvent;
}

function createDragEventWithOptions(options: {
  dataTransfer?: DragDataTransfer | null;
  relatedTarget?: EventTarget | null;
}): DragEvent {
  let prevented = false;
  return {
    dataTransfer: (options.dataTransfer ?? null) as unknown as DataTransfer,
    relatedTarget: options.relatedTarget ?? null,
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {},
    get defaultPrevented() {
      return prevented;
    },
  } as DragEvent;
}

function createDockZone(targetTabId: string, zone: "left" | "right" | "top" | "bottom" | "center"): FakeDockZone {
  return new FakeDockZone(targetTabId, zone, new FakeOverlay());
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

  test("dock drag drop moves tab via text/plain fallback payload", () => {
    const runtime = createRuntime();
    const zone = createDockZone("tab-a", "right");
    const root = new FakeDockRoot([zone]);
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
    transfer.setData(TAB_DOCK_DRAG_MIME, "");
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
    const zone = createDockZone("tab-a", "left");
    const root = new FakeDockRoot([zone]);

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

  test("dock move remains local when bridge unavailable", () => {
    const runtime = createRuntime();
    const zone = createDockZone("tab-a", "center");
    const root = new FakeDockRoot([zone]);
    let renderPartsCalls = 0;

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {},
      renderParts() {
        renderPartsCalls += 1;
      },
      renderSyncStatus() {},
    });

    const transfer = new MemoryDataTransfer();
    transfer.setData(TAB_DOCK_DRAG_MIME, "");
    transfer.setData("text/plain", "tab-b");
    zone.dispatch("drop", createDragEvent(transfer));

    assertEqual(runtime.contextState.activeTabId, "tab-b", "local dock move should still activate tab");
    assertEqual(renderPartsCalls, 1, "local dock move should still rerender parts");
  });

  test("dock drop blocks explicit cross-window payloads", () => {
    const runtime = createRuntime();
    const zone = createDockZone("tab-a", "top");
    const root = new FakeDockRoot([zone]);
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
    transfer.setData(TAB_DOCK_DRAG_MIME, JSON.stringify({ tabId: "tab-b", sourceWindowId: "window-b" }));
    zone.dispatch("drop", createDragEvent(transfer));

    assertEqual(runtime.contextState.activeTabId, beforeActive, "cross-window dock payload should be ignored");
    assertEqual(renderPartsCalls, 0, "cross-window dock payload should not trigger rerender");
  });

  test("degraded mode still permits same-window dock moves", () => {
    const runtime = createRuntime();
    runtime.syncDegraded = true;
    runtime.syncDegradedReason = "publish-failed";
    const zone = createDockZone("tab-a", "bottom");
    const root = new FakeDockRoot([zone]);
    let renderPartsCalls = 0;

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {},
      renderParts() {
        renderPartsCalls += 1;
      },
      renderSyncStatus() {},
    });

    const transfer = new MemoryDataTransfer();
    transfer.setData(TAB_DOCK_DRAG_MIME, "");
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

  test("dragover/drop accepts active drag fallback when DataTransfer reads are empty", () => {
    const runtime = createRuntime();
    const zone = createDockZone("tab-a", "right");
    const root = new FakeDockRoot([zone]);
    let renderPartsCalls = 0;

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {},
      renderParts() {
        renderPartsCalls += 1;
      },
      renderSyncStatus() {},
    });

    setActiveDockDragPayload(root as unknown as HTMLElement, {
      tabId: "tab-b",
      sourceWindowId: "window-a",
    });

    const emptyReadTransfer = new EmptyReadDataTransfer();
    const dragoverEvent = createDragEvent(emptyReadTransfer);
    zone.dispatch("dragover", dragoverEvent);
    zone.dispatch("drop", createDragEvent(emptyReadTransfer));

    assertEqual(dragoverEvent.defaultPrevented, true, "active drag fallback should arm drop zone");
    assertEqual(runtime.contextState.activeTabId, "tab-b", "active drag fallback should still move tab");
    assertEqual(renderPartsCalls, 1, "active drag fallback should rerender parts");
  });

  test("dock dragend fallback applies most recent armed zone move", () => {
    const runtime = createRuntime();
    const zone = createDockZone("tab-a", "right");
    const root = new FakeDockRoot([zone]);
    let renderPartsCalls = 0;

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {},
      renderParts() {
        renderPartsCalls += 1;
      },
      renderSyncStatus() {},
    });

    const armTransfer = new MemoryDataTransfer();
    armTransfer.setData(TAB_DOCK_DRAG_MIME, JSON.stringify({ tabId: "tab-b", sourceWindowId: "window-a" }));
    zone.dispatch("dragover", createDragEvent(armTransfer));

    root.dispatch("dragend", createDragEvent(armTransfer));

    assertEqual(runtime.contextState.activeTabId, "tab-b", "dragend fallback should still move docked tab");
    assertEqual(renderPartsCalls, 1, "dragend fallback should rerender parts once");
  });

  test("dragleave moving inside same overlay keeps armed dock target", () => {
    const runtime = createRuntime();
    const overlay = new FakeOverlay();
    const leftZone = new FakeDockZone("tab-a", "left", overlay);
    const rightZone = new FakeDockZone("tab-a", "right", overlay);
    const root = new FakeDockRoot([leftZone, rightZone]);

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {},
      renderParts() {},
      renderSyncStatus() {},
    });

    const transfer = new MemoryDataTransfer();
    transfer.setData(TAB_DOCK_DRAG_MIME, JSON.stringify({ tabId: "tab-b", sourceWindowId: "window-a" }));
    leftZone.dispatch("dragover", createDragEvent(transfer));
    leftZone.dispatch("dragleave", createDragEventWithOptions({ dataTransfer: transfer, relatedTarget: rightZone as unknown as EventTarget }));

    root.dispatch("dragend", createDragEvent(transfer));

    assertEqual(runtime.contextState.activeTabId, "tab-b", "in-overlay dragleave should preserve armed drop target for fallback move");
  });

  test("drop without dataTransfer still applies active payload fallback", () => {
    const runtime = createRuntime();
    const zone = createDockZone("tab-a", "bottom");
    const root = new FakeDockRoot([zone]);
    let renderPartsCalls = 0;

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {},
      renderParts() {
        renderPartsCalls += 1;
      },
      renderSyncStatus() {},
    });

    setActiveDockDragPayload(root as unknown as HTMLElement, {
      tabId: "tab-b",
      sourceWindowId: "window-a",
    });

    zone.dispatch("drop", createDragEventWithOptions({ dataTransfer: null }));

    assertEqual(runtime.contextState.activeTabId, "tab-b", "null dataTransfer drop should still move tab via active payload");
    assertEqual(renderPartsCalls, 1, "null dataTransfer fallback move should rerender parts");
  });
}
