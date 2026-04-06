import { cloneContextState, ensureGroup } from "./helpers.js";
import {
  ContextTabCloseability,
  ContextTabSlot,
  ClosedTabHistoryEntry,
  ShellContextState,
} from "./types.js";

const CLOSED_TAB_HISTORY_LIMIT = 10;

function clampClosedTabHistory(entries: ClosedTabHistoryEntry[]): ClosedTabHistoryEntry[] {
  return entries.slice(0, CLOSED_TAB_HISTORY_LIMIT);
}

function isClosedTabEntryRestorable(
  entry: ClosedTabHistoryEntry,
): entry is ClosedTabHistoryEntry {
  return Boolean(
    entry.tabId
      && entry.groupId
      && entry.label
      && (entry.closePolicy === "fixed" || entry.closePolicy === "closeable")
      && (entry.slot === "main" || entry.slot === "secondary" || entry.slot === "side"),
  );
}

function normalizeInsertIndex(currentOrder: string[], desiredIndex: number): number {
  if (!Number.isFinite(desiredIndex)) {
    return currentOrder.length;
  }

  const clamped = Math.max(0, Math.min(Math.trunc(desiredIndex), currentOrder.length));
  return clamped;
}
export function registerTab(
  state: ShellContextState,
  input: {
    tabId: string;
    definitionId?: string;
    groupId: string;
    groupColor?: string;
    tabLabel?: string;
    closePolicy?: "fixed" | "closeable";
  },
): ShellContextState {
  const next = cloneContextState(state);
  ensureGroup(next, input.groupId, input.groupColor);
  const prior = next.tabs[input.tabId];
  next.tabs[input.tabId] = {
    id: input.tabId,
    definitionId: input.definitionId ?? prior?.definitionId ?? input.tabId,
    groupId: input.groupId,
    label: input.tabLabel ?? prior?.label ?? input.tabId,
    closePolicy: input.closePolicy ?? prior?.closePolicy ?? "fixed",
  };
  if (!next.tabOrder.includes(input.tabId)) {
    next.tabOrder.push(input.tabId);
  }
  if (!next.activeTabId) {
    next.activeTabId = input.tabId;
  }
  return next;
}

export function setActiveTab(state: ShellContextState, tabId: string): ShellContextState {
  if (!state.tabs[tabId] || state.activeTabId === tabId) {
    return state;
  }

  return {
    ...state,
    activeTabId: tabId,
  };
}

export function moveTabToGroup(
  state: ShellContextState,
  input: { tabId: string; targetGroupId: string; targetGroupColor?: string },
): ShellContextState {
  const tab = state.tabs[input.tabId];
  if (!tab) {
    return state;
  }

  const next = cloneContextState(state);
  ensureGroup(next, input.targetGroupId, input.targetGroupColor);
  next.tabs[input.tabId] = {
    id: input.tabId,
    definitionId: tab.definitionId,
    groupId: input.targetGroupId,
    label: tab.label,
    closePolicy: tab.closePolicy,
  };
  return next;
}

export function closeTab(state: ShellContextState, tabId: string): ShellContextState {
  if (!state.tabs[tabId]) {
    return state;
  }

  const orderedTabIds = state.tabOrder.filter((id) => state.tabs[id]);
  const closedTabOrderIndex = orderedTabIds.indexOf(tabId);
  const next = cloneContextState(state);
  delete next.tabs[tabId];
  next.tabOrder = orderedTabIds.filter((id) => id !== tabId && next.tabs[id]);
  delete next.subcontextsByTab[tabId];

  if (next.activeTabId === tabId) {
    const rightCandidate = orderedTabIds
      .slice(closedTabOrderIndex + 1)
      .find((id) => id !== tabId && next.tabs[id]);
    if (rightCandidate) {
      next.activeTabId = rightCandidate;
    } else {
      const leftCandidate = [...orderedTabIds.slice(0, Math.max(closedTabOrderIndex, 0))]
        .reverse()
        .find((id) => id !== tabId && next.tabs[id]);
      next.activeTabId = leftCandidate ?? null;
    }
  } else if (next.activeTabId && !next.tabs[next.activeTabId]) {
    next.activeTabId = next.tabOrder[0] ?? null;
  }

  return next;
}

export function closeTabWithHistory(
  state: ShellContextState,
  input: {
    tabId: string;
    slot: ContextTabSlot;
    orderIndex: number;
  },
): ShellContextState {
  const tab = state.tabs[input.tabId];
  if (!tab) {
    return state;
  }

  const closedEntry: ClosedTabHistoryEntry = {
    tabId: tab.id,
    definitionId: tab.definitionId,
    groupId: tab.groupId,
    label: tab.label,
    closePolicy: tab.closePolicy,
    slot: input.slot,
  };

  if (!isClosedTabEntryRestorable(closedEntry)) {
    return closeTab(state, input.tabId);
  }

  const next = closeTab(state, input.tabId);
  const slotHistory = next.closedTabHistoryBySlot[input.slot].filter((entry) => entry.tabId !== input.tabId);
  next.closedTabHistoryBySlot[input.slot] = clampClosedTabHistory([
    {
      ...closedEntry,
      ...(Number.isFinite(input.orderIndex) ? { orderIndex: Math.max(0, Math.trunc(input.orderIndex)) } : {}),
    },
    ...slotHistory,
  ]);

  return next;
}

export function canReopenClosedTab(state: ShellContextState, slot: ContextTabSlot): boolean {
  return state.closedTabHistoryBySlot[slot].some((entry) => isClosedTabEntryRestorable(entry));
}

export function reopenMostRecentlyClosedTab(
  state: ShellContextState,
  slot: ContextTabSlot,
): ShellContextState {
  const slotHistory = state.closedTabHistoryBySlot[slot];
  if (slotHistory.length === 0) {
    return state;
  }

  const next = cloneContextState(state);
  let reopenedEntry: (ClosedTabHistoryEntry & { orderIndex?: number }) | null = null;
  const retained: ClosedTabHistoryEntry[] = [];

  for (const candidate of slotHistory) {
    if (!reopenedEntry && isClosedTabEntryRestorable(candidate) && !next.tabs[candidate.tabId]) {
      reopenedEntry = candidate as ClosedTabHistoryEntry & { orderIndex?: number };
      continue;
    }

    if (isClosedTabEntryRestorable(candidate) && !next.tabs[candidate.tabId]) {
      retained.push(candidate);
    }
  }

  next.closedTabHistoryBySlot[slot] = clampClosedTabHistory(retained);
  if (!reopenedEntry) {
    return next;
  }

  ensureGroup(next, reopenedEntry.groupId);
  next.tabs[reopenedEntry.tabId] = {
    id: reopenedEntry.tabId,
    definitionId: reopenedEntry.definitionId ?? reopenedEntry.tabId,
    groupId: reopenedEntry.groupId,
    label: reopenedEntry.label,
    closePolicy: reopenedEntry.closePolicy,
  };

  const existingOrder = next.tabOrder.filter((id) => next.tabs[id] && id !== reopenedEntry!.tabId);
  const insertIndex = normalizeInsertIndex(existingOrder, reopenedEntry.orderIndex ?? Number.POSITIVE_INFINITY);
  next.tabOrder = [
    ...existingOrder.slice(0, insertIndex),
    reopenedEntry.tabId,
    ...existingOrder.slice(insertIndex),
  ];
  next.activeTabId = reopenedEntry.tabId;

  return next;
}

export function getTabCloseability(state: ShellContextState, tabId: string): ContextTabCloseability {
  const tab = state.tabs[tabId];
  if (!tab || tab.closePolicy === "fixed") {
    return {
      policy: tab?.closePolicy ?? "fixed",
      canClose: false,
      actionAvailability: "disabled",
      reason: "fixed-policy",
    };
  }

  return {
    policy: tab.closePolicy,
    canClose: true,
    actionAvailability: "enabled",
    reason: null,
  };
}

export function closeTabIfAllowed(state: ShellContextState, tabId: string): ShellContextState {
  const closeability = getTabCloseability(state, tabId);
  if (!closeability.canClose) {
    return state;
  }

  return closeTab(state, tabId);
}

export function closeTabIfAllowedWithHistory(
  state: ShellContextState,
  input: {
    tabId: string;
    slot: ContextTabSlot;
    orderIndex: number;
  },
): ShellContextState {
  const closeability = getTabCloseability(state, input.tabId);
  if (!closeability.canClose) {
    return state;
  }

  return closeTabWithHistory(state, input);
}

export function getTabGroupId(state: ShellContextState, tabId: string): string | null {
  return state.tabs[tabId]?.groupId ?? null;
}
