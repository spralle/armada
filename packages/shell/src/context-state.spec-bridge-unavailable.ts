import type {
  AsyncWindowBridge,
  AsyncWindowBridgeHealth,
  AsyncWindowBridgePublishResult,
  WindowBridge,
  WindowBridgeEvent,
  WindowBridgeHealth,
} from "@ghost-shell/bridge";
import type { ShellRuntime } from "./app/types.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { bindBridgeSync } from "./shell-runtime/bridge-sync-handlers.js";
import { publishWithDegrade } from "./sync/bridge-degraded.js";

class StubWindowBridge implements WindowBridge {
  available = true;

  publish(): boolean {
    return true;
  }

  subscribe(): () => void {
    return () => {};
  }

  subscribeHealth(listener: (health: WindowBridgeHealth) => void): () => void {
    listener({ degraded: false, reason: null });
    return () => {};
  }

  recover(): void {
    // no-op
  }

  close(): void {
    // no-op
  }
}

class TestAsyncBridge implements AsyncWindowBridge {
  available = true;
  recoverCalls = 0;
  publishedEvents: WindowBridgeEvent[] = [];
  publishResult: AsyncWindowBridgePublishResult = {
    status: "accepted",
    disposition: "enqueued",
  };

  private readonly listeners = new Set<(event: WindowBridgeEvent) => void>();
  private readonly healthListeners = new Set<(health: AsyncWindowBridgeHealth) => void>();

  async publish(event: WindowBridgeEvent): Promise<AsyncWindowBridgePublishResult> {
    this.publishedEvents.push(event);
    return this.publishResult;
  }

  subscribe(listener: (event: WindowBridgeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeHealth(listener: (health: AsyncWindowBridgeHealth) => void): () => void {
    this.healthListeners.add(listener);
    listener({
      sequence: 1,
      state: "healthy",
      reason: null,
    });
    return () => {
      this.healthListeners.delete(listener);
    };
  }

  async recover(): Promise<void> {
    this.recoverCalls += 1;
  }

  close(): void {
    // no-op
  }

  emitEvent(event: WindowBridgeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  emitHealth(health: AsyncWindowBridgeHealth): void {
    for (const listener of this.healthListeners) {
      listener(health);
    }
  }
}

function createRootStub(): HTMLElement {
  return {
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  } as unknown as HTMLElement;
}

function createRuntime(asyncBridge: TestAsyncBridge): ShellRuntime {
  return {
    bridge: new StubWindowBridge(),
    asyncBridge,
    dragSessionBroker: {
      available: true,
    },
    syncDegraded: false,
    syncHealthState: "healthy",
    syncDegradedReason: null,
    pendingProbeId: null,
    windowId: "host-window",
    hostWindowId: null,
    isPopout: false,
    popoutTabId: null,
    poppedOutTabIds: new Set<string>(),
    popoutHandles: new Map<string, Window>(),
    selectedPartId: null,
    selectedPartTitle: null,
    contextState: {} as ShellRuntime["contextState"],
    contextPersistence: {
      save() {
        return { warning: null };
      },
    } as unknown as ShellRuntime["contextPersistence"],
    registry: {
      getSnapshot() {
        return {
          plugins: [],
        };
      },
    } as unknown as ShellRuntime["registry"],
    notice: "",
    pluginNotice: "",
    intentNotice: "",
    activeIntentSession: null,
    lastIntentTrace: null,
    closeableTabIds: new Set<string>(),
    announcement: "",
    pendingFocusSelector: null,
    actionSurface: {} as unknown as ShellRuntime["actionSurface"],
    intentRuntime: {} as unknown as ShellRuntime["intentRuntime"],
    actionNotice: "",
    partHost: null as unknown as ShellRuntime["partHost"],
    activeTransportPath: "async-scomp-adapter",
    activeTransportReason: "async-flag-enabled",
    layout: {} as unknown as ShellRuntime["layout"],
    persistence: {} as unknown as ShellRuntime["persistence"],
  } as unknown as ShellRuntime;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

export function registerBridgeUnavailableSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("enters degraded mode when async publish rejects", async () => {
    const asyncBridge = new TestAsyncBridge();
    asyncBridge.publishResult = {
      status: "rejected",
      reason: "channel-error",
    };
    const runtime = createRuntime(asyncBridge);
    const announcements: string[] = [];

    publishWithDegrade(
      runtime,
      {
        type: "selection",
        selectedPartId: "tab-a",
        selectedPartTitle: "Tab A",
        selectionByEntityType: {},
        revision: { timestamp: 10, writer: "host-window" },
        sourceWindowId: "host-window",
      },
      {
        announce(message) {
          announcements.push(message);
        },
        updateWindowReadOnlyState() {},
        renderSyncStatus() {},
        renderContextControls() {},
      },
    );

    assertEqual(
      asyncBridge.publishedEvents[0]?.type,
      "selection",
      "async publish should enqueue selection event before promise settles",
    );
    await flushMicrotasks();
    assertEqual(runtime.syncDegraded, true, "async rejection should set degraded mode");
    assertEqual(runtime.syncHealthState, "degraded", "async rejection should set degraded health state");
    assertEqual(runtime.syncDegradedReason, "channel-error", "async rejection should preserve reject reason");
    assertTruthy(
      announcements[0]?.includes("Cross-window sync degraded"),
      "async rejection should announce degraded mode",
    );
  });

  test("recovery requires healthy signal and matching probe ack", () => {
    const asyncBridge = new TestAsyncBridge();
    const runtime = createRuntime(asyncBridge);
    const root = createRootStub();

    bindBridgeSync(root, runtime, {
      announce() {},
      applyContext() {},
      applySelection() {},
      createWindowId() {
        return "probe-health";
      },
      renderContextControlsPanel() {},
      renderParts() {},
      renderSyncStatus() {},
      summarizeSelectionPriorities() {
        return "none";
      },
    });

    asyncBridge.emitHealth({ sequence: 2, state: "degraded", reason: "channel-error" });
    assertEqual(runtime.syncDegraded, true, "degraded health should enable degraded mode");

    asyncBridge.emitHealth({ sequence: 3, state: "healthy", reason: null });
    assertEqual(runtime.syncDegraded, true, "healthy signal alone should not recover mode");
    assertEqual(runtime.pendingProbeId, "probe-health", "healthy signal should request probe");

    asyncBridge.emitEvent({
      type: "sync-ack",
      probeId: "probe-health",
      targetWindowId: "host-window",
      sourceWindowId: "peer-window",
    });

    assertEqual(runtime.syncDegraded, false, "matching ack should recover mode");
    assertEqual(runtime.syncHealthState, "healthy", "recovery should preserve healthy state");
    assertEqual(runtime.syncDegradedReason, null, "recovery should clear degraded reason");
    assertEqual(runtime.pendingProbeId, null, "recovery should clear pending probe id");
    assertEqual(asyncBridge.recoverCalls, 1, "recovery should call async bridge recover");
  });

  test("stale ack after re-degrade does not oscillate back healthy", () => {
    const asyncBridge = new TestAsyncBridge();
    const runtime = createRuntime(asyncBridge);
    const root = createRootStub();

    bindBridgeSync(root, runtime, {
      announce() {},
      applyContext() {},
      applySelection() {},
      createWindowId() {
        return "probe-race";
      },
      renderContextControlsPanel() {},
      renderParts() {},
      renderSyncStatus() {},
      summarizeSelectionPriorities() {
        return "none";
      },
    });

    asyncBridge.emitHealth({ sequence: 2, state: "degraded", reason: "channel-error" });
    asyncBridge.emitHealth({ sequence: 3, state: "healthy", reason: null });
    assertEqual(runtime.pendingProbeId, "probe-race", "healthy signal should request probe");

    asyncBridge.emitHealth({ sequence: 4, state: "degraded", reason: "publish-failed" });
    assertEqual(runtime.pendingProbeId, null, "re-degrade should clear pending probe");

    asyncBridge.emitEvent({
      type: "sync-ack",
      probeId: "probe-race",
      targetWindowId: "host-window",
      sourceWindowId: "peer-window",
    });

    assertEqual(runtime.syncDegraded, true, "stale ack should not recover after re-degrade");
    assertEqual(runtime.syncHealthState, "degraded", "stale ack should preserve degraded health state");
    assertEqual(runtime.syncDegradedReason, "publish-failed", "stale ack should preserve latest reason");
    assertEqual(asyncBridge.recoverCalls, 0, "stale ack should not trigger recover");
  });
}
