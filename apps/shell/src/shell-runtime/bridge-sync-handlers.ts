import {
  CORE_GROUP_CONTEXT_KEY,
  createRevision,
  resolveActiveTabId,
} from "../context/runtime-state.js";
import {
  formatDegradedModeAnnouncement,
  formatSelectionAnnouncement,
} from "../keyboard-a11y.js";
import {
  handleSyncAck as handleSyncAckState,
  handleSyncProbe as handleSyncProbeState,
  publishWithDegrade as publishWithDegradeState,
  requestSyncProbe as requestSyncProbeState,
} from "../sync/bridge-degraded.js";
import { updateWindowReadOnlyState } from "../ui/context-controls.js";
import { restorePart } from "../ui/parts-controller.js";
import type { ShellRuntime } from "../app/types.js";
import { getTabGroupId } from "../context-state.js";
import { buildGroupContextSyncEvent } from "../sync/bridge-payloads.js";
import type {
  ContextSyncEvent,
  SelectionSyncEvent,
  WindowBridgeEvent,
} from "../window-bridge.js";

export interface BridgeSyncBindings {
  announce: (message: string) => void;
  applyContext: (event: ContextSyncEvent) => void;
  applySelection: (event: SelectionSyncEvent) => void;
  createWindowId: () => string;
  renderContextControlsPanel: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
  summarizeSelectionPriorities: () => string;
}

export function bindBridgeSync(
  root: HTMLElement,
  runtime: ShellRuntime,
  bindings: BridgeSyncBindings,
): void {
  runtime.bridge.subscribeHealth((health) => {
    if (health.degraded) {
      runtime.syncDegraded = true;
      runtime.syncDegradedReason = health.reason;
      runtime.pendingProbeId = null;
      bindings.announce(formatDegradedModeAnnouncement(true, runtime.syncDegradedReason));
      updateWindowReadOnlyState(root, runtime);
      bindings.renderSyncStatus();
      bindings.renderContextControlsPanel();
      return;
    }

    if (runtime.syncDegraded) {
      requestSyncProbe(root, runtime, bindings);
      bindings.renderSyncStatus();
      bindings.renderContextControlsPanel();
      updateWindowReadOnlyState(root, runtime);
      return;
    }

    runtime.syncDegradedReason = null;
    bindings.announce(formatDegradedModeAnnouncement(false, null));
    updateWindowReadOnlyState(root, runtime);
  });

  runtime.bridge.subscribe((event) => {
    if (event.sourceWindowId === runtime.windowId) {
      return;
    }

    if (event.type === "sync-probe") {
      handleSyncProbe(runtime, event);
      return;
    }

    if (event.type === "sync-ack") {
      if (handleSyncAck(root, runtime, event, bindings)) {
        return;
      }
    }

    if (runtime.syncDegraded) {
      return;
    }

    if (event.type === "selection") {
      bindings.applySelection(event);
      return;
    }

    if (event.type === "context") {
      bindings.applyContext(event);
      return;
    }

    if (event.type === "popout-restore-request" && !runtime.isPopout) {
      if (event.hostWindowId !== runtime.windowId) {
        return;
      }

      restorePart(event.partId, runtime, {
        renderParts: () => bindings.renderParts(),
        renderSyncStatus: () => bindings.renderSyncStatus(),
      });
      return;
    }

  });
}

export function announce(root: HTMLElement, runtime: ShellRuntime, message: string): void {
  runtime.announcement = message;
  const node = root.querySelector<HTMLElement>("#live-announcer");
  if (!node) {
    return;
  }
  node.textContent = message;
}

export function applySelectionAnnouncement(runtime: ShellRuntime, bindings: BridgeSyncBindings): void {
  bindings.announce(formatSelectionAnnouncement({
    selectedPartTitle: runtime.selectedPartTitle,
    selectedEntitySummary: bindings.summarizeSelectionPriorities(),
  }));
}

export function publishWithDegrade(
  root: HTMLElement,
  runtime: ShellRuntime,
  event: WindowBridgeEvent,
  bindings: BridgeSyncBindings,
): boolean {
  return publishWithDegradeState(runtime, event, {
    announce: (message) => bindings.announce(message),
    updateWindowReadOnlyState: () => updateWindowReadOnlyState(root, runtime),
    renderSyncStatus: () => bindings.renderSyncStatus(),
    renderContextControls: () => bindings.renderContextControlsPanel(),
  });
}

export function requestSyncProbe(
  root: HTMLElement,
  runtime: ShellRuntime,
  bindings: BridgeSyncBindings,
): void {
  requestSyncProbeState(runtime, {
    announce: (message) => bindings.announce(message),
    updateWindowReadOnlyState: () => updateWindowReadOnlyState(root, runtime),
    renderSyncStatus: () => bindings.renderSyncStatus(),
    renderContextControls: () => bindings.renderContextControlsPanel(),
  }, bindings.createWindowId);
}

function handleSyncProbe(
  runtime: ShellRuntime,
  event: WindowBridgeEvent,
): void {
  if (event.type !== "sync-probe") {
    return;
  }
  handleSyncProbeState(runtime, event);
}

function handleSyncAck(
  root: HTMLElement,
  runtime: ShellRuntime,
  event: WindowBridgeEvent,
  bindings: BridgeSyncBindings,
): boolean {
  if (event.type !== "sync-ack") {
    return false;
  }
  return handleSyncAckState(runtime, event, {
    announce: (message) => bindings.announce(message),
    updateWindowReadOnlyState: () => updateWindowReadOnlyState(root, runtime),
    renderSyncStatus: () => bindings.renderSyncStatus(),
    renderContextControls: () => bindings.renderContextControlsPanel(),
  });
}

export function buildContextSyncEvent(
  runtime: ShellRuntime,
  contextValue: string,
): ContextSyncEvent {
  const activeTabId = resolveActiveTabId(runtime);
  const activeGroupId = activeTabId
    ? (getTabGroupId(runtime.contextState, activeTabId) ?? undefined)
    : undefined;

  // Keep tab-scoped fields for migration compatibility while preferring group-targeted sync.
  return buildGroupContextSyncEvent({
    tabId: activeTabId ?? undefined,
    groupId: activeGroupId,
    contextKey: CORE_GROUP_CONTEXT_KEY,
    contextValue,
    revision: createRevision(runtime.windowId),
    sourceWindowId: runtime.windowId,
  });
}
