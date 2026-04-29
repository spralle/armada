import type { ShellRuntime } from "../app/types.js";
import { updateContextState } from "../context/runtime-state.js";
import { applyIncomingTransferTransaction, type DockDropZone } from "../context-state.js";

export interface CrossWindowDockDropInput {
  tabId: string;
  sourceWindowId: string;
  targetTabId: string;
  zone: DockDropZone;
  transferSessionId: string | null;
}

export interface CrossWindowDockDropDeps {
  renderContextControls: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
}

export function handleCrossWindowDockDrop(
  runtime: ShellRuntime,
  input: CrossWindowDockDropInput,
  deps: CrossWindowDockDropDeps,
): boolean {
  if (runtime.crossWindowDndKillSwitchActive || !runtime.crossWindowDndEnabled) {
    runtime.notice = "Cross-window tab drag is disabled by current settings.";
    abortIfPossible(runtime, input.transferSessionId);
    deps.renderSyncStatus();
    return false;
  }

  if (runtime.syncDegraded) {
    runtime.notice = "Cross-window tab drag is unavailable while sync is degraded.";
    abortIfPossible(runtime, input.transferSessionId);
    deps.renderSyncStatus();
    return false;
  }

  if (!input.transferSessionId) {
    runtime.notice = "Cross-window tab drag payload is invalid.";
    deps.renderSyncStatus();
    return false;
  }

  const transferResult = applyIncomingTransferTransaction(runtime.contextState, runtime.incomingTransferJournal, {
    transferId: input.transferSessionId,
    correlationId: input.transferSessionId,
    sourceWindowId: input.sourceWindowId,
    targetWindowId: runtime.windowId,
    tab: {
      tabId: input.tabId,
    },
    target: {
      kind: "dock-zone",
      targetTabId: input.targetTabId,
      zone: input.zone,
    },
  });
  runtime.incomingTransferJournal = transferResult.journal;
  if (!transferResult.applied && !transferResult.duplicate) {
    runtime.notice = "Cross-window tab drop could not be applied.";
    runtime.dragSessionBroker.abort({ id: input.transferSessionId }, runtime.windowId);
    deps.renderSyncStatus();
    return false;
  }

  updateContextState(runtime, transferResult.state);
  runtime.dragSessionBroker.commit({ id: input.transferSessionId }, runtime.windowId);
  runtime.notice = "";
  runtime.selectedPartId = input.tabId;
  runtime.selectedPartTitle = runtime.contextState.tabs[input.tabId]?.label ?? input.tabId;
  runtime.pendingFocusSelector = `button[data-action='activate-tab'][data-part-id='${input.tabId}']`;
  deps.renderContextControls();
  deps.renderParts();
  deps.renderSyncStatus();
  return true;
}

function abortIfPossible(runtime: ShellRuntime, transferSessionId: string | null): void {
  if (!transferSessionId) {
    return;
  }

  runtime.dragSessionBroker.abort({ id: transferSessionId }, runtime.windowId);
}
