import { DRAG_INLINE_PREFIX, TAB_DOCK_DRAG_MIME } from "./app/constants.js";
import {
  createDockZone,
  createDragEvent,
  createDragEventWithOptions,
  createRuntime,
  EmptyReadDataTransfer,
  FakeDockRoot,
  FakeDockZone,
  FakeOverlay,
  MemoryDataTransfer,
} from "./context-state.spec-dock-tab-drag-drop-fixtures.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { setActiveDockDragPayload } from "./ui/dock-drag-session.js";
import { moveDockTabThroughRuntime, wireDockTabDragDrop } from "./ui/dock-tab-dnd.js";

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
    runtime.crossWindowDndEnabled = false;
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
    assertEqual(
      runtime.notice,
      "Cross-window tab drag is disabled by current settings.",
      "cross-window dock rejection should expose clear disabled-mode notice",
    );
  });

  test("dock cross-window payload applies through transfer transaction when enabled", () => {
    const runtime = createRuntime();
    runtime.crossWindowDndEnabled = true;
    const commits: string[] = [];
    runtime.dragSessionBroker = {
      ...runtime.dragSessionBroker,
      consume: () => ({ tabId: "tab-b", sourceWindowId: "window-b" }),
      commit(ref) {
        commits.push(ref.id);
        return true;
      },
      abort: () => false,
    };
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

    const transfer = new MemoryDataTransfer();
    transfer.setData("text/plain", "ghost-dnd-ref:session-cross-dock");
    zone.dispatch("drop", createDragEvent(transfer));

    assertEqual(
      runtime.contextState.activeTabId,
      "tab-b",
      "enabled cross-window dock drop should activate incoming tab",
    );
    assertEqual(renderPartsCalls, 1, "enabled cross-window dock drop should rerender parts");
    assertEqual(
      commits.join(","),
      "session-cross-dock",
      "enabled cross-window dock drop should commit transfer session",
    );
    assertEqual(runtime.notice, "", "enabled cross-window dock drop should clear rejection notice");
  });

  test("dock cross-window payload rejected by kill-switch shows notice and aborts", () => {
    const runtime = createRuntime();
    runtime.crossWindowDndEnabled = true;
    runtime.crossWindowDndKillSwitchActive = true;
    const aborts: string[] = [];
    runtime.dragSessionBroker = {
      ...runtime.dragSessionBroker,
      consume: () => ({ tabId: "tab-b", sourceWindowId: "window-b" }),
      commit: () => false,
      abort(ref) {
        aborts.push(ref.id);
        return true;
      },
    };
    const zone = createDockZone("tab-a", "left");
    const root = new FakeDockRoot([zone]);

    wireDockTabDragDrop(root as unknown as HTMLElement, runtime, {
      renderContextControls() {},
      renderParts() {},
      renderSyncStatus() {},
    });

    const before = runtime.contextState;
    const transfer = new MemoryDataTransfer();
    transfer.setData("text/plain", "ghost-dnd-ref:session-cross-dock-kill");
    zone.dispatch("drop", createDragEvent(transfer));

    assertEqual(
      runtime.contextState,
      before,
      "kill-switch cross-window dock drop should preserve same-window behavior",
    );
    assertEqual(
      runtime.notice,
      "Cross-window tab drag is disabled by current settings.",
      "kill-switch cross-window dock drop should show clear rejection notice",
    );
    assertEqual(
      aborts.join(","),
      "session-cross-dock-kill",
      "kill-switch cross-window dock drop should abort transfer session",
    );
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

    const moved = moveDockTabThroughRuntime(
      runtime,
      {
        renderContextControls() {},
        renderParts() {
          renderPartsCalls += 1;
        },
        renderSyncStatus() {
          renderSyncCalls += 1;
        },
      },
      {
        tabId: "tab-b",
        sourceWindowId: "window-a",
        targetTabId: "tab-a",
        zone: "left",
      },
    );

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
    leftZone.dispatch(
      "dragleave",
      createDragEventWithOptions({ dataTransfer: transfer, relatedTarget: rightZone as unknown as EventTarget }),
    );

    root.dispatch("dragend", createDragEvent(transfer));

    assertEqual(
      runtime.contextState.activeTabId,
      "tab-b",
      "in-overlay dragleave should preserve armed drop target for fallback move",
    );
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

    assertEqual(
      runtime.contextState.activeTabId,
      "tab-b",
      "null dataTransfer drop should still move tab via active payload",
    );
    assertEqual(renderPartsCalls, 1, "null dataTransfer fallback move should rerender parts");
  });
}
