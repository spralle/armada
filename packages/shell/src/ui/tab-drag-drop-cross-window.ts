import type { ShellRuntime } from "../app/types.js";
import { updateContextState } from "../context/runtime-state.js";
import { applyIncomingTransferTransaction } from "../context-state.js";

export interface CrossWindowTabDropInput {
  tabId: string;
  sourceWindowId: string;
  targetTabId: string;
  transferSessionId: string | null;
}

export interface CrossWindowTabDropDeps {
  onTabMoved: (tabId: string) => void;
  onStateChange: () => void;
}

export function handleCrossWindowTabStripDrop(
  runtime: ShellRuntime,
  input: CrossWindowTabDropInput,
  deps: CrossWindowTabDropDeps,
): boolean {
  if (runtime.crossWindowDndKillSwitchActive || !runtime.crossWindowDndEnabled) {
    runtime.notice = "Cross-window tab drag is disabled by current settings.";
    abortIfPossible(runtime, input.transferSessionId);
    deps.onStateChange();
    return true;
  }

  if (runtime.syncDegraded) {
    runtime.notice = "Cross-window tab drag is unavailable while sync is degraded.";
    abortIfPossible(runtime, input.transferSessionId);
    deps.onStateChange();
    return true;
  }

  if (!input.transferSessionId) {
    runtime.notice = "Cross-window tab drag payload is invalid.";
    deps.onStateChange();
    return true;
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
      kind: "tab-strip",
      beforeTabId: input.targetTabId,
    },
  });
  runtime.incomingTransferJournal = transferResult.journal;
  if (!transferResult.applied && !transferResult.duplicate) {
    runtime.notice = "Cross-window tab drop could not be applied.";
    runtime.dragSessionBroker.abort({ id: input.transferSessionId }, runtime.windowId);
    deps.onStateChange();
    return true;
  }

  updateContextState(runtime, transferResult.state);
  runtime.dragSessionBroker.commit({ id: input.transferSessionId }, runtime.windowId);
  runtime.notice = "";
  deps.onTabMoved(input.tabId);
  deps.onStateChange();
  return true;
}

function abortIfPossible(runtime: ShellRuntime, transferSessionId: string | null): void {
  if (!transferSessionId) {
    return;
  }

  runtime.dragSessionBroker.abort({ id: transferSessionId }, runtime.windowId);
}
