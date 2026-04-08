import type { ShellRuntime } from "./app/types.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { createInitialShellContextState, registerTab } from "./context-state.js";
import {
  handleSyncAck,
  publishWithDegrade,
  requestSyncProbe,
} from "./sync/bridge-degraded.js";
import { bindBridgeSync } from "./shell-runtime/bridge-sync-handlers.js";
import { createRuntimeEventHandlers } from "./shell-runtime/runtime-event-handlers.js";
import { readGlobalContext } from "./context/runtime-state.js";
import type {
  WindowBridge,
  WindowBridgeEvent,
  WindowBridgeHealth,
} from "./window-bridge.js";

class TestBridge implements WindowBridge {
  available = true;
  publishShouldSucceed = true;
  recoverCalls = 0;
  publishedEvents: WindowBridgeEvent[] = [];

  private readonly listeners = new Set<(event: WindowBridgeEvent) => void>();
  private readonly healthListeners = new Set<(health: WindowBridgeHealth) => void>();

  publish(event: WindowBridgeEvent): boolean {
    this.publishedEvents.push(event);
    return this.publishShouldSucceed;
  }

  subscribe(listener: (event: WindowBridgeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeHealth(listener: (health: WindowBridgeHealth) => void): () => void {
    this.healthListeners.add(listener);
    listener({ degraded: false, reason: null });
    return () => {
      this.healthListeners.delete(listener);
    };
  }

  recover(): void {
    this.recoverCalls += 1;
  }

  dispose(): void {}

  emit(event: WindowBridgeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  emitHealth(health: WindowBridgeHealth): void {
    for (const listener of this.healthListeners) {
      listener(health);
    }
  }
}

function createReadOnlySafeRoot(): HTMLElement {
  return {
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  } as unknown as HTMLElement;
}

function createRuntime(bridge: TestBridge): ShellRuntime {
  let popoutClosed = false;
  const popoutHandle = {
    get closed() {
      return popoutClosed;
    },
    close() {
      popoutClosed = true;
    },
  } as unknown as Window;

  return {
    bridge,
    dragSessionBroker: {
      available: true,
      create() {
        return { id: "unused" };
      },
      consume() {
        return null;
      },
      dispose() {},
    },
    syncDegraded: false,
    syncDegradedReason: null,
    pendingProbeId: null,
    windowId: "host-window",
    hostWindowId: null,
    isPopout: false,
    popoutTabId: null,
    poppedOutTabIds: new Set(["part-a"]),
    popoutHandles: new Map([["part-a", popoutHandle]]),
    selectedPartId: "tab-a",
    selectedPartTitle: "Tab A",
    contextState: registerTab(createInitialShellContextState({
      initialTabId: "tab-a",
      initialGroupId: "group-main",
    }), {
      tabId: "tab-b",
      groupId: "group-main",
      closePolicy: "closeable",
    }),
    contextPersistence: {
      save() {
        return { warning: null };
      },
    },
    registry: {
      getSnapshot() {
        return {
          plugins: [],
        };
      },
    },
    notice: "",
  } as unknown as ShellRuntime;
}

export function registerSyncPopoutDegradedSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("sync degrade path marks runtime read-only and ack recovery restores writable mode", () => {
    const bridge = new TestBridge();
    const runtime = createRuntime(bridge);
    const announcements: string[] = [];
    let readOnlyUpdates = 0;
    let syncRenders = 0;
    let contextRenders = 0;

    bridge.publishShouldSucceed = false;
    const published = publishWithDegrade(runtime, {
      type: "selection",
      selectedPartId: "tab-a",
      selectedPartTitle: "Tab A",
      selectionByEntityType: {},
      revision: { timestamp: 1, writer: "host-window" },
      sourceWindowId: "host-window",
    }, {
      announce(message) {
        announcements.push(message);
      },
      updateWindowReadOnlyState() {
        readOnlyUpdates += 1;
      },
      renderSyncStatus() {
        syncRenders += 1;
      },
      renderContextControls() {
        contextRenders += 1;
      },
    });

    assertEqual(published, false, "publish should fail when bridge rejects event");
    assertEqual(runtime.syncDegraded, true, "runtime should become degraded after publish failure");
    assertEqual(runtime.syncDegradedReason, "publish-failed", "degraded reason should explain failure path");
    assertEqual(readOnlyUpdates, 1, "degrade should trigger read-only state update");
    assertEqual(syncRenders, 1, "degrade should render sync status");
    assertEqual(contextRenders, 1, "degrade should render context controls");
    assertTruthy(
      announcements[0]?.includes("Cross-window sync degraded"),
      "degrade path should announce read-only mode",
    );

    runtime.pendingProbeId = "probe-1";
    bridge.publishShouldSucceed = true;
    const recovered = handleSyncAck(runtime, {
      type: "sync-ack",
      probeId: "probe-1",
      targetWindowId: "host-window",
      sourceWindowId: "peer-window",
    }, {
      announce(message) {
        announcements.push(message);
      },
      updateWindowReadOnlyState() {
        readOnlyUpdates += 1;
      },
      renderSyncStatus() {
        syncRenders += 1;
      },
      renderContextControls() {
        contextRenders += 1;
      },
    });

    assertEqual(recovered, true, "matching ack should be consumed");
    assertEqual(runtime.syncDegraded, false, "matching ack should restore healthy mode");
    assertEqual(runtime.syncDegradedReason, null, "healthy mode should clear degrade reason");
    assertEqual(runtime.pendingProbeId, null, "matching ack should clear pending probe id");
    assertEqual(bridge.recoverCalls, 1, "matching ack should ask bridge to recover health");
    assertTruthy(
      announcements[1]?.includes("sync restored"),
      "recovery path should announce writable mode",
    );
  });

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

  test("requestSyncProbe publishes probe and remote sync-probe emits targeted ack", () => {
    const bridge = new TestBridge();
    const runtime = createRuntime(bridge);
    const root = createReadOnlySafeRoot();

    bindBridgeSync(root, runtime, {
      announce() {},
      applyContext() {},
      applySelection() {},
      createWindowId() {
        return "probe-bindings";
      },
      renderContextControlsPanel() {},
      renderParts() {},
      renderSyncStatus() {},
      summarizeSelectionPriorities() {
        return "none";
      },
    });

    requestSyncProbe(runtime, {
      announce() {},
      updateWindowReadOnlyState() {},
      renderSyncStatus() {},
      renderContextControls() {},
    }, () => "probe-123");

    assertEqual(runtime.pendingProbeId, "probe-123", "sync probe should track pending probe id");
    assertEqual(bridge.publishedEvents[0]?.type, "sync-probe", "sync probe should publish probe event");

    bridge.emit({
      type: "sync-probe",
      probeId: "remote-probe",
      sourceWindowId: "peer-window",
    });

    const ackEvent = bridge.publishedEvents.find((event) => event.type === "sync-ack");
    assertTruthy(ackEvent, "incoming remote probe should publish targeted sync-ack");
    if (ackEvent?.type === "sync-ack") {
      assertEqual(ackEvent.targetWindowId, "peer-window", "sync-ack should target probing window id");
    }
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
