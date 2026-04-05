import { formatDegradedModeAnnouncement } from "../keyboard-a11y.js";
import type { SyncAckEvent, SyncProbeEvent, WindowBridge } from "../window-bridge.js";
import type { ShellRuntime } from "../app/types.js";

export interface BridgeRenderBindings {
  announce: (message: string) => void;
  updateWindowReadOnlyState: () => void;
  renderSyncStatus: () => void;
  renderContextControls: () => void;
}

export function renderBridgeWarning(runtime: ShellRuntime): string {
  if (!runtime.syncDegraded && runtime.bridge.available && runtime.dragSessionBroker.available) {
    return "";
  }

  if (runtime.syncDegraded) {
    return `<div class="bridge-warning">Cross-window sync degraded (${runtime.syncDegradedReason ?? "unknown"}). This window is read-only until resync succeeds.</div>`;
  }

  return `<div class="bridge-warning">BroadcastChannel is unavailable. Sync/popout restore/dnd ref fall back to local-only behavior.</div>`;
}

export function publishWithDegrade(
  runtime: ShellRuntime,
  event: Parameters<WindowBridge["publish"]>[0],
  bindings: BridgeRenderBindings,
): boolean {
  if (runtime.syncDegraded) {
    return false;
  }

  const success = runtime.bridge.publish(event);
  if (!success) {
    runtime.syncDegraded = true;
    runtime.syncDegradedReason = "publish-failed";
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
  const ok = runtime.bridge.publish({
    type: "sync-probe",
    probeId,
    sourceWindowId: runtime.windowId,
  });

  if (!ok) {
    runtime.syncDegraded = true;
    runtime.syncDegradedReason = "publish-failed";
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

  runtime.bridge.publish({
    type: "sync-ack",
    probeId: event.probeId,
    targetWindowId: event.sourceWindowId,
    sourceWindowId: runtime.windowId,
  });
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
