import type { ShellRuntime } from "./app/types.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { bindBridgeSync } from "./shell-runtime/bridge-sync-handlers.js";
import type {
  WindowBridge,
  WindowBridgeEvent,
  WindowBridgeHealth,
} from "./window-bridge.js";

class UnavailableBridge implements WindowBridge {
  readonly available = false;

  publish(_event: WindowBridgeEvent): boolean {
    return false;
  }

  subscribe(_listener: (event: WindowBridgeEvent) => void): () => void {
    return () => {};
  }

  subscribeHealth(listener: (health: WindowBridgeHealth) => void): () => void {
    listener({
      degraded: true,
      reason: "unavailable",
    });
    return () => {};
  }

  recover(): void {}

  dispose(): void {}
}

function createSafeRoot(): HTMLElement {
  return {
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  } as unknown as HTMLElement;
}

export function registerBridgeUnavailableSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("bridge unavailable health keeps runtime writable for local-only mode", () => {
    const runtime = {
      bridge: new UnavailableBridge(),
      syncDegraded: true,
      syncDegradedReason: "publish-failed",
      pendingProbeId: "probe-1",
      windowId: "window-a",
      isPopout: false,
    } as unknown as ShellRuntime;
    const root = createSafeRoot();
    let syncRenders = 0;
    let contextRenders = 0;

    bindBridgeSync(root, runtime, {
      announce() {},
      applyContext() {},
      applySelection() {},
      createWindowId() {
        return "probe-id";
      },
      renderContextControlsPanel() {
        contextRenders += 1;
      },
      renderParts() {},
      renderSyncStatus() {
        syncRenders += 1;
      },
      summarizeSelectionPriorities() {
        return "none";
      },
    });

    assertEqual(runtime.syncDegraded, false, "unavailable bridge should keep local-only mode writable");
    assertEqual(runtime.syncDegradedReason, null, "unavailable bridge should clear degraded reason");
    assertEqual(runtime.pendingProbeId, null, "unavailable bridge should clear pending probes");
    assertEqual(syncRenders, 1, "unavailable bridge should rerender sync status");
    assertEqual(contextRenders, 1, "unavailable bridge should rerender context controls");
  });
}
