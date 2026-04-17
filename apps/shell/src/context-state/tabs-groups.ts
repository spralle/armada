import { cloneContextState, ensureGroup } from "./helpers.js";
import {
  applyDockTabDrop,
  activateTabInDockTree,
  deriveDeterministicActiveTabId,
  ensureTabRegisteredInDockTree,
  removeTabFromDockTree,
} from "./dock-tree.js";
import { findActiveOrFirstStack } from "./dock-tree-helpers.js";
import type { DockDropZone } from "./dock-tree-types.js";
import type { TabPlacementStrategy, PlacementConfig } from "./placement-strategy/types.js";
import {
  ContextTabSlot,
  ClosedTabHistoryEntry,
  ShellContextState,
} from "./types.js";
import {
  clampClosedTabHistory,
  cloneTabArgs,
  collectDockTreeTabIds,
  createTabInstanceId,
  isClosedTabEntryRestorable,
  normalizeInsertIndex,
  resolveTargetGroupId,
} from "./tabs-groups-helpers.js";

export function registerTab(
  state: ShellContextState,
  input: {
    tabId: string;
    definitionId?: string;
    args?: Record<string, string>;
    partDefinitionId?: string;
    groupId: string;
    groupColor?: string;
    tabLabel?: string;
    closePolicy?: "fixed" | "closeable";
    placementStrategy?: TabPlacementStrategy;
    placementConfig?: PlacementConfig;
  },
): ShellContextState {
  const next = cloneContextState(state);
  ensureGroup(next, input.groupId, input.groupColor);
  const prior = next.tabs[input.tabId];
  const resolvedDefinitionId = input.definitionId
    ?? input.partDefinitionId
    ?? prior?.definitionId
    ?? prior?.partDefinitionId
    ?? input.tabId;
  const resolvedPartDefinitionId = input.partDefinitionId
    ?? input.definitionId
    ?? prior?.partDefinitionId
    ?? prior?.definitionId
    ?? input.tabId;
  next.tabs[input.tabId] = {
    id: input.tabId,
    definitionId: resolvedDefinitionId,
    partDefinitionId: resolvedPartDefinitionId,
    groupId: input.groupId,
    label: input.tabLabel ?? prior?.label ?? input.tabId,
    closePolicy: input.closePolicy ?? prior?.closePolicy ?? "closeable",
    args: input.args ?? prior?.args ?? {},
  };
  if (!next.tabOrder.includes(input.tabId)) {
    next.tabOrder.push(input.tabId);
  }
  if (input.placementStrategy) {
    const activeStack = next.dockTree.root ? findActiveOrFirstStack(next.dockTree.root) : null;
    const result = input.placementStrategy.place({
      tabId: input.tabId,
      tree: next.dockTree,
      activeStackId: activeStack?.id,
      dwindleDirection: input.placementConfig?.dwindleDirection,
    });
    next.dockTree = result.tree;
  } else {
    next.dockTree = ensureTabRegisteredInDockTree(next.dockTree, input.tabId);
  }

  if (!next.activeTabId) {
    next.activeTabId = deriveDeterministicActiveTabId(next.dockTree) ?? input.tabId;
  }
  return next;
}

export function openPartInstance(
  state: ShellContextState,
  input: {
    definitionId: string;
    args?: Record<string, string>;
    groupId?: string;
    groupColor?: string;
    tabLabel?: string;
    closePolicy?: "fixed" | "closeable";
    placementStrategy?: TabPlacementStrategy;
    placementConfig?: PlacementConfig;
  },
): { state: ShellContextState; tabId: string } {
  const tabId = createTabInstanceId(state, input.definitionId);
  const next = registerTab(state, {
    tabId,
    definitionId: input.definitionId,
    partDefinitionId: input.definitionId,
    args: cloneTabArgs(input.args),
    groupId: resolveTargetGroupId(state, input.groupId),
    groupColor: input.groupColor,
    tabLabel: input.tabLabel,
    closePolicy: input.closePolicy ?? "closeable",
    placementStrategy: input.placementStrategy,
    placementConfig: input.placementConfig,
  });

  return {
    state: setActiveTab(next, tabId),
    tabId,
  };
}

export function setActiveTab(state: ShellContextState, tabId: string): ShellContextState {
  if (!state.tabs[tabId] || state.activeTabId === tabId) {
    return state;
  }

  return {
    ...state,
    dockTree: activateTabInDockTree(state.dockTree, tabId),
    activeTabId: tabId,
  };
}

export function moveTabInDockTree(
  state: ShellContextState,
  input: {
    tabId: string;
    targetTabId: string;
    zone: DockDropZone;
  },
): ShellContextState {
  if (!state.tabs[input.tabId] || !state.tabs[input.targetTabId]) {
    return state;
  }

  const next = cloneContextState(state);
  next.dockTree = applyDockTabDrop(next.dockTree, input);
  next.tabOrder = next.tabOrder.filter((tabId) => next.tabs[tabId]);
  for (const stackTabId of collectDockTreeTabIds(next.dockTree.root)) {
    if (!next.tabOrder.includes(stackTabId) && next.tabs[stackTabId]) {
      next.tabOrder.push(stackTabId);
    }
  }
  next.activeTabId = next.tabs[input.tabId]
    ? input.tabId
    : deriveDeterministicActiveTabId(next.dockTree)
      ?? next.tabOrder[0]
      ?? null;
  return next;
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
    partDefinitionId: tab.partDefinitionId ?? tab.definitionId,
    groupId: input.targetGroupId,
    label: tab.label,
    closePolicy: tab.closePolicy,
    args: tab.args,
  };
  return next;
}

export function moveTabBeforeTab(
  state: ShellContextState,
  input: { tabId: string; beforeTabId: string },
): ShellContextState {
  const { tabId, beforeTabId } = input;
  if (tabId === beforeTabId) {
    return state;
  }

  if (!state.tabs[tabId] || !state.tabs[beforeTabId]) {
    return state;
  }

  const next = cloneContextState(state);
  const ordered = next.tabOrder.filter((id) => next.tabs[id] && id !== tabId);
  const targetIndex = ordered.indexOf(beforeTabId);
  if (targetIndex < 0) {
    return state;
  }

  next.tabOrder = [
    ...ordered.slice(0, targetIndex),
    tabId,
    ...ordered.slice(targetIndex),
  ];

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
  next.dockTree = removeTabFromDockTree(next.dockTree, tabId);

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

  if (!next.activeTabId || !next.tabs[next.activeTabId]) {
    next.activeTabId = deriveDeterministicActiveTabId(next.dockTree)
      ?? next.tabOrder[0]
      ?? null;
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
    args: cloneTabArgs(tab.args),
    partDefinitionId: tab.partDefinitionId ?? tab.definitionId,
    groupId: tab.groupId,
    label: tab.label,
    closePolicy: tab.closePolicy,
    slot: input.slot,
  };

  if (!isClosedTabEntryRestorable(closedEntry)) {
    return closeTab(state, input.tabId);
  }

  const next = closeTab(state, input.tabId);
  const filteredHistory = next.closedTabHistory.filter((entry) => entry.tabId !== input.tabId);
  next.closedTabHistory = clampClosedTabHistory([
    {
      ...closedEntry,
      ...(Number.isFinite(input.orderIndex) ? { orderIndex: Math.max(0, Math.trunc(input.orderIndex)) } : {}),
    },
    ...filteredHistory,
  ]);

  return next;
}

export function canReopenClosedTab(state: ShellContextState, slot: ContextTabSlot): boolean {
  return state.closedTabHistory.some(
    (entry) => entry.slot === slot && isClosedTabEntryRestorable(entry),
  );
}

export function reopenMostRecentlyClosedTab(
  state: ShellContextState,
  slot: ContextTabSlot,
): ShellContextState {
  const slotHistory = state.closedTabHistory.filter((entry) => entry.slot === slot);
  if (slotHistory.length === 0) {
    return state;
  }

  const next = cloneContextState(state);
  let reopenedEntry: (ClosedTabHistoryEntry & { orderIndex?: number }) | null = null;
  const retained: ClosedTabHistoryEntry[] = [];

  for (const candidate of slotHistory) {
    if (
      !reopenedEntry
      && isClosedTabEntryRestorable(candidate)
      && !next.tabs[candidate.tabId]
    ) {
      reopenedEntry = candidate as ClosedTabHistoryEntry & { orderIndex?: number };
      continue;
    }

    if (isClosedTabEntryRestorable(candidate) && !next.tabs[candidate.tabId]) {
      retained.push(candidate);
    }
  }

  next.closedTabHistory = clampClosedTabHistory([
    ...state.closedTabHistory.filter((entry) => entry.slot !== slot),
    ...retained,
  ]);
  if (!reopenedEntry) {
    return next;
  }

  ensureGroup(next, reopenedEntry.groupId);
  next.tabs[reopenedEntry.tabId] = {
    id: reopenedEntry.tabId,
    definitionId: reopenedEntry.definitionId ?? reopenedEntry.tabId,
    partDefinitionId: reopenedEntry.partDefinitionId ?? reopenedEntry.definitionId ?? reopenedEntry.tabId,
    groupId: reopenedEntry.groupId,
    label: reopenedEntry.label,
    closePolicy: reopenedEntry.closePolicy,
    args: reopenedEntry.args ?? {},
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

