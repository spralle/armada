import { formatDegradedModeAnnouncement } from "../keyboard-a11y.js";
import type { SyncAckEvent, SyncProbeEvent, WindowBridge } from "../window-bridge.js";
import type { ShellRuntime } from "../app/types.js";
import {
  normalizeBridgePublishRejectionReason,
  type AsyncWindowBridgePublishResult,
} from "../app/async-bridge.js";

export interface BridgeRenderBindings {
  announce: (message: string) => void;
  updateWindowReadOnlyState: () => void;
  renderSyncStatus: () => void;
  renderContextControls: () => void;
}

export function getBridgeWarningMessage(runtime: ShellRuntime): string | null {
  if (!runtime.syncDegraded && runtime.bridge.available && runtime.dragSessionBroker.available) {
    return null;
  }

  if (runtime.syncDegraded) {
    return `Cross-window sync degraded (${runtime.syncDegradedReason ?? "unknown"}). This window is read-only until resync succeeds.`;
  }

  return "BroadcastChannel is unavailable. Sync/popout restore/dnd ref fall back to local-only behavior.";
}

export function publishWithDegrade(
  runtime: ShellRuntime,
  event: Parameters<WindowBridge["publish"]>[0],
  bindings: BridgeRenderBindings,
): boolean {
  if (!runtime.bridge.available) {
    return false;
  }

  if (runtime.syncDegraded) {
    return false;
  }

  const result = publishBridgeEvent(runtime, event, bindings);
  if (result.status === "rejected") {
    runtime.syncDegraded = true;
    runtime.syncDegradedReason = result.reason;
    runtime.pendingProbeId = null;
    bindings.announce(formatDegradedModeAnnouncement(true, runtime.syncDegradedReason));
    bindings.updateWindowReadOnlyState();
    bindings.renderSyncStatus();
    bindings.renderContextControls();
    return false;
  }

  return true;
}

export function requestSyncProbe(runtime: ShellRuntime, bindings: BridgeRenderBindings, createWindowId: () => string): void {
  if (!runtime.bridge.available) {
    return;
  }

  const probeId = createWindowId();
  runtime.pendingProbeId = probeId;
  const result = publishBridgeEvent(runtime, {
    type: "sync-probe",
    probeId,
    sourceWindowId: runtime.windowId,
  }, bindings);

  if (result.status === "rejected") {
    runtime.syncDegraded = true;
    runtime.syncDegradedReason = result.reason;
    runtime.pendingProbeId = null;
    bindings.announce(formatDegradedModeAnnouncement(true, runtime.syncDegradedReason));
    bindings.updateWindowReadOnlyState();
    bindings.renderSyncStatus();
    bindings.renderContextControls();
  }
}

export function handleSyncProbe(runtime: ShellRuntime, event: SyncProbeEvent): void {
  if (runtime.syncDegraded) {
    return;
  }

  publishBridgeEvent(runtime, {
    type: "sync-ack",
    probeId: event.probeId,
    targetWindowId: event.sourceWindowId,
    sourceWindowId: runtime.windowId,
  }, null);
}

function publishBridgeEvent(
  runtime: ShellRuntime,
  event: Parameters<WindowBridge["publish"]>[0],
  bindings: BridgeRenderBindings | null,
): AsyncWindowBridgePublishResult {
  if (runtime.activeTransportPath === "async-scomp-adapter") {
    void runtime.asyncBridge.publish(event).then((publishResult) => {
      if (publishResult.status === "accepted") {
        return;
      }

      runtime.syncDegraded = true;
      runtime.syncDegradedReason = publishResult.reason;
      runtime.pendingProbeId = null;

      if (bindings) {
        bindings.announce(formatDegradedModeAnnouncement(true, runtime.syncDegradedReason));
        bindings.updateWindowReadOnlyState();
        bindings.renderSyncStatus();
        bindings.renderContextControls();
      }
    });

    return {
      status: "accepted",
      disposition: "enqueued",
    };
  }

  const published = runtime.bridge.publish(event);
  return published
    ? {
      status: "accepted",
      disposition: "enqueued",
    }
    : {
      status: "rejected",
      reason: normalizeBridgePublishRejectionReason(
        runtime.syncDegradedReason,
        runtime.bridge.available,
      ),
    };
}

export function handleSyncAck(
  runtime: ShellRuntime,
  event: SyncAckEvent,
  bindings: BridgeRenderBindings,
): boolean {
  if (event.targetWindowId !== runtime.windowId) {
    return false;
  }

  if (!runtime.syncDegraded || !runtime.pendingProbeId || event.probeId !== runtime.pendingProbeId) {
    return true;
  }

  runtime.pendingProbeId = null;
  runtime.syncDegraded = false;
  runtime.syncDegradedReason = null;
  runtime.bridge.recover();
  bindings.announce(formatDegradedModeAnnouncement(false, null));
  bindings.updateWindowReadOnlyState();
  bindings.renderSyncStatus();
  bindings.renderContextControls();
  return true;
}
