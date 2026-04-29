import { cloneDockTree } from "./dock-tree.js";
import type { EntityTypeSelection, RevisionMeta, ShellContextState } from "./types.js";

export function cloneContextState(state: ShellContextState): ShellContextState {
  const nextGroupLanes: ShellContextState["groupLanes"] = {};
  for (const groupId in state.groupLanes) {
    nextGroupLanes[groupId] = { ...state.groupLanes[groupId] };
  }

  const nextSubcontextsByTab: ShellContextState["subcontextsByTab"] = {};
  for (const tabId in state.subcontextsByTab) {
    nextSubcontextsByTab[tabId] = { ...state.subcontextsByTab[tabId] };
  }

  const nextSelections: ShellContextState["selectionByEntityType"] = {};
  for (const entityType in state.selectionByEntityType) {
    const selection = state.selectionByEntityType[entityType];
    nextSelections[entityType] = {
      selectedIds: [...selection.selectedIds],
      priorityId: selection.priorityId,
    };
  }

  return {
    groups: { ...state.groups },
    tabs: { ...state.tabs },
    tabOrder: [...state.tabOrder],
    activeTabId: state.activeTabId,
    dockTree: cloneDockTree(state.dockTree),
    closedTabHistory: [...state.closedTabHistory],
    globalLanes: { ...state.globalLanes },
    groupLanes: nextGroupLanes,
    subcontextsByTab: nextSubcontextsByTab,
    selectionByEntityType: nextSelections,
  };
}

export function ensureGroup(state: ShellContextState, groupId: string, groupColor?: string): void {
  if (!state.groups[groupId]) {
    state.groups[groupId] = {
      id: groupId,
      color: groupColor ?? "blue",
    };
  } else if (groupColor) {
    state.groups[groupId] = {
      ...state.groups[groupId],
      color: groupColor,
    };
  }

  if (!state.groupLanes[groupId]) {
    state.groupLanes[groupId] = {};
  }
}

export function normalizeSelectionIds(input: string[]): string[] {
  const deduped = new Set<string>();
  for (const id of input) {
    if (id) {
      deduped.add(id);
    }
  }
  return [...deduped];
}

export function normalizePriorityId(selectedIds: string[], priorityId: string | null): string | null {
  if (!priorityId) {
    return selectedIds[0] ?? null;
  }

  if (!selectedIds.includes(priorityId)) {
    return selectedIds[0] ?? null;
  }

  return priorityId;
}

export function shouldApplyRevision(current: RevisionMeta | undefined, incoming: RevisionMeta): boolean {
  if (!current) {
    return true;
  }
  if (incoming.timestamp !== current.timestamp) {
    return incoming.timestamp > current.timestamp;
  }
  if (incoming.writer !== current.writer) {
    return incoming.writer > current.writer;
  }
  return false;
}

export function areEqualSelections(a: EntityTypeSelection, b: EntityTypeSelection): boolean {
  if (a.priorityId !== b.priorityId) {
    return false;
  }
  if (a.selectedIds.length !== b.selectedIds.length) {
    return false;
  }
  for (let i = 0; i < a.selectedIds.length; i += 1) {
    if (a.selectedIds[i] !== b.selectedIds[i]) {
      return false;
    }
  }
  return true;
}

export function compareDeterministicKeys(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
