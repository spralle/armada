import type { SyncAckEvent, SyncProbeEvent, WindowBridge } from "@ghost-shell/bridge";
import {
  type AsyncWindowBridgeHealth,
  type AsyncWindowBridgeRejectReason,
  normalizeBridgePublishRejectionReason,
} from "@ghost-shell/bridge";
import type { BridgeHost, DndHost } from "../app/types.js";
import { formatDegradedModeAnnouncement } from "../keyboard-a11y.js";

export interface BridgeRenderBindings {
  announce: (message: string) => void;
  updateWindowReadOnlyState: () => void;
  renderSyncStatus: () => void;
  renderContextControls: () => void;
}

export function getBridgeWarningMessage(runtime: BridgeHost & DndHost): string | null {
  if (!runtime.syncDegraded && runtime.bridge.available && runtime.dragSessionBroker.available) {
    return null;
  }

  if (runtime.syncDegraded) {
    return `Cross-window sync degraded (${runtime.syncDegradedReason ?? "unknown"}). This window is read-only until resync succeeds.`;
  }

  return "BroadcastChannel is unavailable. Sync/popout restore/dnd ref fall back to local-only behavior.";
}

export function publishWithDegrade(
  runtime: BridgeHost,
  event: Parameters<WindowBridge["publish"]>[0],
  bindings: BridgeRenderBindings,
): boolean {
  if (!runtime.bridge.available && runtime.activeTransportPath !== "async-scomp-adapter") {
    return false;
  }

  if (runtime.syncDegraded) {
    return false;
  }

  return publishBridgeEvent(runtime, event, {
    onRejected: (reason) => enterDegradedMode(runtime, reason, bindings),
  });
}

export function requestSyncProbe(
  runtime: BridgeHost,
  bindings: BridgeRenderBindings,
  createWindowId: () => string,
): void {
  if (!runtime.bridge.available && runtime.activeTransportPath !== "async-scomp-adapter") {
    return;
  }

  if (runtime.pendingProbeId) {
    return;
  }

  const probeId = createWindowId();
  runtime.pendingProbeId = probeId;
  publishBridgeEvent(
    runtime,
    {
      type: "sync-probe",
      probeId,
      sourceWindowId: runtime.windowId,
    },
    {
      onRejected: (reason) => enterDegradedMode(runtime, reason, bindings),
    },
  );
}

export function handleSyncProbe(runtime: BridgeHost, event: SyncProbeEvent, bindings: BridgeRenderBindings): void {
  if (runtime.syncDegraded) {
    return;
  }

  publishBridgeEvent(
    runtime,
    {
      type: "sync-ack",
      probeId: event.probeId,
      targetWindowId: event.sourceWindowId,
      sourceWindowId: runtime.windowId,
    },
    {
      onRejected: (reason) => enterDegradedMode(runtime, reason, bindings),
    },
  );
}

function publishBridgeEvent(
  runtime: BridgeHost,
  event: Parameters<WindowBridge["publish"]>[0],
  options?: {
    onRejected?: (reason: AsyncWindowBridgeRejectReason) => void;
  },
): boolean {
  if (runtime.activeTransportPath === "async-scomp-adapter") {
    void runtime.asyncBridge
      .publish(event)
      .then((result) => {
        if (result.status === "rejected") {
          options?.onRejected?.(result.reason);
        }
      })
      .catch(() => {
        options?.onRejected?.(
          normalizeBridgePublishRejectionReason(runtime.syncDegradedReason, runtime.bridge.available),
        );
      });

    return true;
  }

  const published = runtime.bridge.publish(event);
  if (published) {
    return true;
  }

  options?.onRejected?.(normalizeBridgePublishRejectionReason(runtime.syncDegradedReason, runtime.bridge.available));
  return false;
}

export function handleSyncAck(runtime: BridgeHost, event: SyncAckEvent, bindings: BridgeRenderBindings): boolean {
  if (event.targetWindowId !== runtime.windowId) {
    return false;
  }

  if (!runtime.syncDegraded || !runtime.pendingProbeId || event.probeId !== runtime.pendingProbeId) {
    return true;
  }

  const requiresHealthyState = runtime.activeTransportPath === "async-scomp-adapter";
  const healthState = runtime.syncHealthState ?? "healthy";
  if (requiresHealthyState && healthState !== "healthy") {
    runtime.pendingProbeId = null;
    return true;
  }

  leaveDegradedMode(runtime, bindings);

  if (runtime.activeTransportPath === "async-scomp-adapter") {
    void runtime.asyncBridge.recover();
  } else {
    runtime.bridge.recover();
  }
  return true;
}

export function handleBridgeHealth(
  runtime: BridgeHost,
  health: AsyncWindowBridgeHealth,
  bindings: BridgeRenderBindings,
  requestProbe: () => void,
): void {
  runtime.syncHealthState = health.state;

  if (health.state !== "healthy") {
    enterDegradedMode(
      runtime,
      health.reason ?? normalizeBridgePublishRejectionReason(runtime.syncDegradedReason, runtime.bridge.available),
      bindings,
      health.state,
    );
    return;
  }

  if (runtime.syncDegraded) {
    requestProbe();
  }
}

function enterDegradedMode(
  runtime: BridgeHost,
  reason: AsyncWindowBridgeRejectReason,
  bindings: BridgeRenderBindings,
  state: "degraded" | "unavailable" = reason === "unavailable" ? "unavailable" : "degraded",
): void {
  const changed =
    !runtime.syncDegraded ||
    runtime.syncDegradedReason !== reason ||
    runtime.pendingProbeId !== null ||
    runtime.syncHealthState !== state;

  runtime.syncDegraded = true;
  runtime.syncHealthState = state;
  runtime.syncDegradedReason = reason;
  runtime.pendingProbeId = null;

  if (!changed) {
    return;
  }

  bindings.announce(formatDegradedModeAnnouncement(true, runtime.syncDegradedReason));
  bindings.updateWindowReadOnlyState();
  bindings.renderSyncStatus();
  bindings.renderContextControls();
}

function leaveDegradedMode(runtime: BridgeHost, bindings: BridgeRenderBindings): void {
  const changed =
    runtime.syncDegraded ||
    runtime.syncDegradedReason !== null ||
    runtime.syncHealthState !== "healthy" ||
    runtime.pendingProbeId !== null;

  runtime.pendingProbeId = null;
  runtime.syncDegraded = false;
  runtime.syncHealthState = "healthy";
  runtime.syncDegradedReason = null;

  if (!changed) {
    return;
  }

  bindings.announce(formatDegradedModeAnnouncement(false, null));
  bindings.updateWindowReadOnlyState();
  bindings.renderSyncStatus();
  bindings.renderContextControls();
}
