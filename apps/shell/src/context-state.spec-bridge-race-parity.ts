import type { ShellRuntime } from "./app/types.js";
import type {
  AsyncWindowBridge,
  AsyncWindowBridgeHealth,
  AsyncWindowBridgePublishResult,
} from "./app/async-bridge.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import {
  bindBridgeSync,
  requestSyncProbe,
} from "./shell-runtime/bridge-sync-handlers.js";
import type {
  WindowBridge,
  WindowBridgeEvent,
  WindowBridgeHealth,
} from "./window-bridge.js";

class StubWindowBridge implements WindowBridge {
  available = true;
  publishedEvents: WindowBridgeEvent[] = [];
  recoverCalls = 0;

  publish(event: WindowBridgeEvent): boolean {
    this.publishedEvents.push(event);
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
    this.recoverCalls += 1;
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

  emitHealth(health: AsyncWindowBridgeHealth): void {
    for (const listener of this.healthListeners) {
      listener(health);
    }
  }

  emitEvent(event: WindowBridgeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

type SyncBindingStubs = {
  renderSyncStatusCalls: number;
  renderContextControlsPanelCalls: number;
  announceMessages: string[];
};

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

function createRuntimeForPath(path: "legacy-bridge" | "async-scomp-adapter"): ShellRuntime {
  const bridge = new StubWindowBridge();
  return {
    bridge,
    asyncBridge: new TestAsyncBridge(),
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
        return { plugins: [] };
      },
    } as unknown as ShellRuntime["registry"],
    notice: "",
    pluginNotice: "",
    intentNotice: "",
    pendingIntentMatches: [],
    pendingIntent: null,
    lastIntentTrace: null,
    closeableTabIds: new Set<string>(),
    announcement: "",
    chooserFocusIndex: 0,
    pendingFocusSelector: null,
    chooserReturnFocusSelector: null,
    actionSurface: {} as unknown as ShellRuntime["actionSurface"],
    intentRuntime: {} as unknown as ShellRuntime["intentRuntime"],
    commandNotice: "",
    partHost: null as unknown as ShellRuntime["partHost"],
    activeTransportPath: path,
    activeTransportReason: path === "async-scomp-adapter" ? "async-flag-enabled" : "default-legacy",
    layout: {} as unknown as ShellRuntime["layout"],
    persistence: {} as unknown as ShellRuntime["persistence"],
  } as unknown as ShellRuntime;
}

function createBridgeSyncBindings(stubs: SyncBindingStubs) {
  return {
    announce(message: string) {
      stubs.announceMessages.push(message);
    },
    applyContext() {
      // no-op
    },
    applySelection() {
      // no-op
    },
    createWindowId() {
      return "probe-parity";
    },
    renderContextControlsPanel() {
      stubs.renderContextControlsPanelCalls += 1;
    },
    renderParts() {
      // no-op
    },
    renderSyncStatus() {
      stubs.renderSyncStatusCalls += 1;
    },
    summarizeSelectionPriorities() {
      return "none";
    },
  };
}

function createBindingCounters(): SyncBindingStubs {
  return {
    renderSyncStatusCalls: 0,
    renderContextControlsPanelCalls: 0,
    announceMessages: [],
  };
}

export function registerBridgeRaceAndParitySpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("out-of-order async health callbacks are ignored by sequence", () => {
    const runtime = createRuntimeForPath("async-scomp-adapter");
    const asyncBridge = runtime.asyncBridge as TestAsyncBridge;
    const root = createRootStub();
    const counters = createBindingCounters();

    bindBridgeSync(root, runtime, createBridgeSyncBindings(counters));

    asyncBridge.emitHealth({ sequence: 4, state: "degraded", reason: "channel-error" });
    assertEqual(runtime.syncHealthState, "degraded", "newer degraded health should apply");

    asyncBridge.emitHealth({ sequence: 3, state: "healthy", reason: null });
    assertEqual(runtime.syncHealthState, "degraded", "older health callback should be ignored");
    assertEqual(runtime.syncDegraded, true, "out-of-order health should preserve degraded mode");
  });

  test("sync probe publish parity across legacy and async transport paths", async () => {
    const legacyRuntime = createRuntimeForPath("legacy-bridge");
    const asyncRuntime = createRuntimeForPath("async-scomp-adapter");
    const legacyCounters = createBindingCounters();
    const asyncCounters = createBindingCounters();
    const legacyRoot = createRootStub();
    const asyncRoot = createRootStub();

    bindBridgeSync(legacyRoot, legacyRuntime, createBridgeSyncBindings(legacyCounters));
    bindBridgeSync(asyncRoot, asyncRuntime, createBridgeSyncBindings(asyncCounters));

    requestSyncProbe(legacyRoot, legacyRuntime, createBridgeSyncBindings(legacyCounters));
    requestSyncProbe(asyncRoot, asyncRuntime, createBridgeSyncBindings(asyncCounters));

    await Promise.resolve();

    const legacyPublished = (legacyRuntime.bridge as StubWindowBridge).publishedEvents;
    const asyncPublished = (asyncRuntime.asyncBridge as TestAsyncBridge).publishedEvents;
    assertEqual(legacyPublished.length, 1, "legacy path should publish one probe event");
    assertEqual(asyncPublished.length, 1, "async path should publish one probe event");
    assertEqual(legacyPublished[0]?.type, "sync-probe", "legacy path should publish sync-probe");
    assertEqual(asyncPublished[0]?.type, "sync-probe", "async path should publish sync-probe");
    assertEqual(legacyRuntime.pendingProbeId, "probe-parity", "legacy path should set pending probe id");
    assertEqual(asyncRuntime.pendingProbeId, "probe-parity", "async path should set pending probe id");
  });

  test("same-window docking boundary remains no-op under async sync events", () => {
    const runtime = createRuntimeForPath("async-scomp-adapter");
    const asyncBridge = runtime.asyncBridge as TestAsyncBridge;
    const root = createRootStub();
    const counters = createBindingCounters();

    bindBridgeSync(root, runtime, createBridgeSyncBindings(counters));

    asyncBridge.emitEvent({
      type: "selection",
      selectedPartId: "same-window-tab",
      selectedPartTitle: "Same Window",
      selectionByEntityType: {},
      sourceWindowId: runtime.windowId,
    });

    assertEqual(runtime.selectedPartId, null, "same-window selection event should be ignored by boundary guard");
    assertEqual(runtime.syncDegraded, false, "same-window selection should not degrade sync state");
    assertEqual(counters.renderSyncStatusCalls, 0, "same-window selection should not trigger sync render");
    assertEqual(counters.renderContextControlsPanelCalls, 0, "same-window selection should not trigger context controls render");
  });
}
