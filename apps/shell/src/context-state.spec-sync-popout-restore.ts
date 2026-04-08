import type { SpecHarness } from "./context-state.spec-harness.js";
import { readGlobalContext } from "./context/runtime-state.js";
import { bindBridgeSync } from "./shell-runtime/bridge-sync-handlers.js";
import { createRuntimeEventHandlers } from "./shell-runtime/runtime-event-handlers.js";
import {
  createReadOnlySafeRoot,
  createRuntime,
  TestBridge,
} from "./context-state.spec-sync-popout-degraded-fixtures.js";

export function registerSyncPopoutRestoreSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("bridge sync binding restores hosted popout only when host matches and not degraded", () => {
    const bridge = new TestBridge();
    const runtime = createRuntime(bridge);
    const root = createReadOnlySafeRoot();
    let renderPartsCalls = 0;
    let renderSyncCalls = 0;

    bindBridgeSync(root, runtime, {
      announce() {},
      applyContext() {},
      applySelection() {},
      createWindowId() {
        return "probe-1";
      },
      renderContextControlsPanel() {},
      renderParts() {
        renderPartsCalls += 1;
      },
      renderSyncStatus() {
        renderSyncCalls += 1;
      },
      summarizeSelectionPriorities() {
        return "none";
      },
    });

    bridge.emit({
      type: "popout-restore-request",
      tabId: "part-a",
      partId: "part-a",
      hostWindowId: "host-window",
      sourceWindowId: "peer-window",
    });

    assertEqual(runtime.poppedOutTabIds.has("part-a"), false, "matching host restore should reconcile popped-out part");
    assertEqual(runtime.popoutHandles.has("part-a"), false, "matching host restore should clear popout handle");
    assertEqual(renderPartsCalls, 1, "matching host restore should rerender parts once");
    assertEqual(renderSyncCalls, 1, "matching host restore should rerender sync status once");

    runtime.poppedOutTabIds.add("part-a");
    runtime.popoutHandles.set("part-a", {
      closed: false,
      close() {},
    } as unknown as Window);
    runtime.syncDegraded = true;
    bridge.emit({
      type: "popout-restore-request",
      tabId: "part-a",
      partId: "part-a",
      hostWindowId: "host-window",
      sourceWindowId: "peer-window",
    });
    assertEqual(runtime.poppedOutTabIds.has("part-a"), true, "degraded mode should block popout restore mutations");

    runtime.syncDegraded = false;
    bridge.emit({
      type: "popout-restore-request",
      tabId: "part-a",
      partId: "part-a",
      hostWindowId: "other-host-window",
      sourceWindowId: "peer-window",
    });
    assertEqual(runtime.poppedOutTabIds.has("part-a"), true, "non-host windows should ignore restore requests");
  });

  test("bridge sync binding ignores remote topology-mutating tab-close events", () => {
    const bridge = new TestBridge();
    const runtime = createRuntime(bridge);
    const root = createReadOnlySafeRoot();
    let renderPartsCalls = 0;
    let renderSyncCalls = 0;

    bindBridgeSync(root, runtime, {
      announce() {},
      applyContext() {},
      applySelection() {},
      createWindowId() {
        return "probe-1";
      },
      renderContextControlsPanel() {},
      renderParts() {
        renderPartsCalls += 1;
      },
      renderSyncStatus() {
        renderSyncCalls += 1;
      },
      summarizeSelectionPriorities() {
        return "none";
      },
    });

    bridge.emit({
      type: "tab-close",
      tabId: "tab-b",
      sourceWindowId: "peer-window",
    });

    assertEqual(runtime.contextState.tabs["tab-b"]?.id, "tab-b", "remote tab-close should not mutate local tab topology");
    assertEqual(runtime.contextState.tabOrder.join(","), "tab-a,tab-b", "remote tab-close should not mutate local tab order");
    assertEqual(renderPartsCalls, 0, "remote tab-close should not trigger part rerender");
    assertEqual(renderSyncCalls, 0, "remote tab-close should not trigger sync rerender");
  });

  test("remote selection sync updates global lane without mutating local topology", () => {
    const bridge = new TestBridge();
    const runtime = createRuntime(bridge);
    const root = createReadOnlySafeRoot();
    const baselineOrder = runtime.contextState.tabOrder.join(",");

    const handlers = createRuntimeEventHandlers(root, runtime, {
      activatePluginForBoundary: async () => false,
      announce() {},
      renderCommandSurface() {},
      renderContextControlsPanel() {},
      renderParts() {},
      renderSyncStatus() {},
      summarizeSelectionPriorities() {
        return "none";
      },
    });

    handlers.applySelection({
      type: "selection",
      selectedPartId: "tab-remote",
      selectedPartTitle: "Remote Tab",
      selectionByEntityType: {},
      revision: { timestamp: 3, writer: "peer-window" },
      sourceWindowId: "peer-window",
    });

    assertEqual(runtime.contextState.tabs["tab-remote"], undefined, "remote selection should not register remote tab locally");
    assertEqual(runtime.contextState.activeTabId, "tab-a", "remote selection should not change local active tab");
    assertEqual(runtime.selectedPartId, "tab-a", "remote selection should not change local selected part");
    assertEqual(runtime.contextState.tabOrder.join(","), baselineOrder, "remote selection should keep local tab order unchanged");
    assertEqual(readGlobalContext(runtime), "tab-remote|Remote Tab", "remote selection should still update global selection lane");
  });

  test("bridge sync ignores remote tab-close events to preserve window-local topology", () => {
    const bridge = new TestBridge();
    const runtime = createRuntime(bridge);
    const root = createReadOnlySafeRoot();
    let renderPartsCalls = 0;
    let renderSyncCalls = 0;

    bindBridgeSync(root, runtime, {
      announce() {},
      applyContext() {},
      applySelection() {},
      createWindowId() {
        return "probe-bindings";
      },
      renderContextControlsPanel() {},
      renderParts() {
        renderPartsCalls += 1;
      },
      renderSyncStatus() {
        renderSyncCalls += 1;
      },
      summarizeSelectionPriorities() {
        return "none";
      },
    });

    bridge.emit({
      type: "tab-close",
      tabId: "part-a",
      sourceWindowId: "peer-window",
    });

    assertEqual(runtime.poppedOutTabIds.has("part-a"), true, "remote tab-close should not mutate local topology state");
    assertEqual(runtime.popoutHandles.has("part-a"), true, "remote tab-close should not close local handles");
    assertEqual(renderPartsCalls, 0, "remote tab-close should not trigger topology rerender");
    assertEqual(renderSyncCalls, 0, "remote tab-close should not trigger sync rerender");
  });
}
