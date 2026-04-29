import { cloneContextState, ensureGroup, shouldApplyRevision } from "./helpers.js";
import type { ContextLaneValue, RevisionMeta, ShellContextState } from "./types.js";

export function writeGlobalLane(
  state: ShellContextState,
  input: {
    key: string;
    value: string;
    revision: RevisionMeta;
    valueType?: string;
    sourceSelection?: {
      entityType: string;
      revision: RevisionMeta;
    };
  },
): ShellContextState {
  const current = state.globalLanes[input.key];
  if (!shouldApplyRevision(current?.revision, input.revision)) {
    return state;
  }

  const next = cloneContextState(state);
  next.globalLanes[input.key] = {
    value: input.value,
    revision: input.revision,
    valueType: input.valueType,
    sourceSelection: input.sourceSelection,
  };
  return next;
}

export function writeGroupLaneByTab(
  state: ShellContextState,
  input: { tabId: string; key: string; value: string; revision: RevisionMeta },
): ShellContextState {
  const tab = state.tabs[input.tabId];
  if (!tab) {
    return state;
  }

  return writeGroupLaneByGroup(state, {
    groupId: tab.groupId,
    key: input.key,
    value: input.value,
    revision: input.revision,
  });
}

export function writeGroupLaneByGroup(
  state: ShellContextState,
  input: {
    groupId: string;
    key: string;
    value: string;
    revision: RevisionMeta;
    groupColor?: string;
    valueType?: string;
    sourceSelection?: {
      entityType: string;
      revision: RevisionMeta;
    };
  },
): ShellContextState {
  const next = cloneContextState(state);
  ensureGroup(next, input.groupId, input.groupColor);
  const current = next.groupLanes[input.groupId]?.[input.key];
  if (!shouldApplyRevision(current?.revision, input.revision)) {
    return state;
  }

  next.groupLanes[input.groupId][input.key] = {
    value: input.value,
    revision: input.revision,
    valueType: input.valueType,
    sourceSelection: input.sourceSelection,
  };
  return next;
}

export function writeTabSubcontext(
  state: ShellContextState,
  input: { tabId: string; key: string; value: string; revision: RevisionMeta },
): ShellContextState {
  if (!state.tabs[input.tabId]) {
    return state;
  }

  const next = cloneContextState(state);
  if (!next.subcontextsByTab[input.tabId]) {
    next.subcontextsByTab[input.tabId] = {};
  }

  const current = next.subcontextsByTab[input.tabId][input.key];
  if (!shouldApplyRevision(current?.revision, input.revision)) {
    return state;
  }

  next.subcontextsByTab[input.tabId][input.key] = {
    value: input.value,
    revision: input.revision,
  };
  return next;
}

export function readGroupLaneForTab(
  state: ShellContextState,
  input: { tabId: string; key: string },
): ContextLaneValue | null {
  const tab = state.tabs[input.tabId];
  if (!tab) {
    return null;
  }
  return state.groupLanes[tab.groupId]?.[input.key] ?? null;
}

export function readGlobalLane(state: ShellContextState, key: string): ContextLaneValue | null {
  return state.globalLanes[key] ?? null;
}
