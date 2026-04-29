import type { DndSessionDeleteEvent, DndSessionUpsertEvent } from "@ghost-shell/bridge";
import type { ShellRuntime, SourceTabTransferPendingState } from "../app/types.js";
import { updateContextState } from "../context/runtime-state.js";
import { closeTab, setActiveTab } from "../context-state.js";

type TabDragPayload = {
  tabId: string;
};

export function beginSourceTabTransferPending(runtime: ShellRuntime, event: DndSessionUpsertEvent): void {
  if (event.lifecycle !== "consume") {
    return;
  }

  const ownerWindowId = event.ownerWindowId ?? event.sourceWindowId;
  if (ownerWindowId !== runtime.windowId) {
    return;
  }

  const consumedByWindowId = event.consumedByWindowId ?? event.sourceWindowId;
  if (consumedByWindowId === runtime.windowId) {
    return;
  }

  const terminalSessionIds = ensureTerminalSessionIds(runtime);
  if (terminalSessionIds.has(event.id)) {
    return;
  }

  const pendingBySessionId = ensurePendingBySessionId(runtime);
  if (pendingBySessionId.has(event.id)) {
    return;
  }

  const payload = asTabDragPayload(event.payload);
  if (!payload || !runtime.contextState.tabs[payload.tabId]) {
    return;
  }

  pendingBySessionId.set(event.id, {
    sessionId: event.id,
    tabId: payload.tabId,
    restoreActiveTabId: runtime.contextState.activeTabId,
    restoreSelectedPartId: runtime.selectedPartId,
    restoreSelectedPartTitle: runtime.selectedPartTitle,
    timeoutAt: event.expiresAt,
  });
}

export function applySourceTabTransferTerminal(runtime: ShellRuntime, event: DndSessionDeleteEvent): void {
  const ownerWindowId = event.ownerWindowId ?? event.sourceWindowId;
  if (ownerWindowId !== runtime.windowId) {
    return;
  }

  const terminalSessionIds = ensureTerminalSessionIds(runtime);
  if (terminalSessionIds.has(event.id)) {
    return;
  }

  const pendingBySessionId = ensurePendingBySessionId(runtime);
  const pending = pendingBySessionId.get(event.id);
  if (!pending) {
    terminalSessionIds.add(event.id);
    return;
  }

  const lifecycle = event.lifecycle ?? "commit";
  if (lifecycle === "commit") {
    applyCommit(runtime, pending);
  } else {
    applyRollback(runtime, pending);
  }

  pendingBySessionId.delete(event.id);
  terminalSessionIds.add(event.id);
}

function applyCommit(runtime: ShellRuntime, pending: SourceTabTransferPendingState): void {
  if (!runtime.contextState.tabs[pending.tabId]) {
    return;
  }

  const next = closeTab(runtime.contextState, pending.tabId);
  updateContextState(runtime, next);

  const activeTabId = runtime.contextState.activeTabId;
  if (!activeTabId || !runtime.contextState.tabs[activeTabId]) {
    runtime.selectedPartId = null;
    runtime.selectedPartTitle = null;
    return;
  }

  runtime.selectedPartId = activeTabId;
  runtime.selectedPartTitle = runtime.contextState.tabs[activeTabId]?.label ?? activeTabId;
}

function applyRollback(runtime: ShellRuntime, pending: SourceTabTransferPendingState): void {
  if (!runtime.contextState.tabs[pending.tabId]) {
    return;
  }

  const restoreActiveTabId = pending.restoreActiveTabId;
  if (restoreActiveTabId && runtime.contextState.tabs[restoreActiveTabId]) {
    updateContextState(runtime, setActiveTab(runtime.contextState, restoreActiveTabId));
  }

  runtime.selectedPartId =
    pending.restoreSelectedPartId && runtime.contextState.tabs[pending.restoreSelectedPartId]
      ? pending.restoreSelectedPartId
      : runtime.contextState.activeTabId;
  runtime.selectedPartTitle = runtime.selectedPartId
    ? (runtime.contextState.tabs[runtime.selectedPartId]?.label ??
      pending.restoreSelectedPartTitle ??
      runtime.selectedPartId)
    : null;
}

function asTabDragPayload(value: unknown): TabDragPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (typeof payload.tabId !== "string") {
    return null;
  }

  return {
    tabId: payload.tabId,
  };
}

function ensurePendingBySessionId(runtime: ShellRuntime): Map<string, SourceTabTransferPendingState> {
  if (!runtime.sourceTabTransferPendingBySessionId) {
    runtime.sourceTabTransferPendingBySessionId = new Map<string, SourceTabTransferPendingState>();
  }

  return runtime.sourceTabTransferPendingBySessionId;
}

function ensureTerminalSessionIds(runtime: ShellRuntime): Set<string> {
  if (!runtime.sourceTabTransferTerminalSessionIds) {
    runtime.sourceTabTransferTerminalSessionIds = new Set<string>();
  }

  return runtime.sourceTabTransferTerminalSessionIds;
}
