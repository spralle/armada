import type { DockNode } from "./dock-tree-types.js";
import type { ClosedTabHistoryEntry, ShellContextState } from "./types.js";

const CLOSED_TAB_HISTORY_LIMIT = 10;

export function clampClosedTabHistory(entries: ClosedTabHistoryEntry[]): ClosedTabHistoryEntry[] {
  return entries.slice(0, CLOSED_TAB_HISTORY_LIMIT);
}

export function isClosedTabEntryRestorable(entry: ClosedTabHistoryEntry): entry is ClosedTabHistoryEntry {
  return Boolean(
    entry.tabId &&
      entry.groupId &&
      entry.label &&
      (entry.closePolicy === "fixed" || entry.closePolicy === "closeable") &&
      (entry.slot === "main" || entry.slot === "secondary" || entry.slot === "side"),
  );
}

export function normalizeInsertIndex(currentOrder: string[], desiredIndex: number): number {
  if (!Number.isFinite(desiredIndex)) {
    return currentOrder.length;
  }

  const clamped = Math.max(0, Math.min(Math.trunc(desiredIndex), currentOrder.length));
  return clamped;
}

export function cloneTabArgs(args: Record<string, string> | undefined): Record<string, string> {
  return args ? { ...args } : {};
}

export function createTabInstanceId(state: ShellContextState, definitionId: string): string {
  if (!state.tabs[definitionId]) {
    return definitionId;
  }

  let index = 2;
  while (true) {
    const candidate = `${definitionId}~${index}`;
    if (!state.tabs[candidate]) {
      return candidate;
    }
    index += 1;
  }
}

export function resolveTargetGroupId(state: ShellContextState, explicitGroupId: string | undefined): string {
  if (explicitGroupId) {
    return explicitGroupId;
  }

  const activeTabId = state.activeTabId;
  if (activeTabId && state.tabs[activeTabId]) {
    return state.tabs[activeTabId].groupId;
  }

  return Object.keys(state.groups)[0] ?? "group-main";
}

export function collectDockTreeTabIds(root: DockNode | null): string[] {
  if (!root) {
    return [];
  }

  if (root.kind === "stack") {
    return [...root.tabIds];
  }

  return [...collectDockTreeTabIds(root.first), ...collectDockTreeTabIds(root.second)];
}
