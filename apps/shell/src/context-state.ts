export interface RevisionMeta {
  timestamp: number;
  writer: string;
}

export interface ContextLaneValue {
  value: string;
  revision: RevisionMeta;
}

export interface ContextGroup {
  id: string;
  color: string;
}

export interface ContextTab {
  id: string;
  groupId: string;
}

export interface ShellContextState {
  groups: Record<string, ContextGroup>;
  tabs: Record<string, ContextTab>;
  tabOrder: string[];
  activeTabId: string | null;
  globalLanes: Record<string, ContextLaneValue>;
  groupLanes: Record<string, Record<string, ContextLaneValue>>;
  subcontextsByTab: Record<string, Record<string, ContextLaneValue>>;
}

export function createInitialShellContextState(options?: {
  initialTabId?: string;
  initialGroupId?: string;
  initialGroupColor?: string;
}): ShellContextState {
  const initialTabId = options?.initialTabId ?? "tab-main";
  const initialGroupId = options?.initialGroupId ?? "group-main";
  const initialGroupColor = options?.initialGroupColor ?? "blue";

  return {
    groups: {
      [initialGroupId]: {
        id: initialGroupId,
        color: initialGroupColor,
      },
    },
    tabs: {
      [initialTabId]: {
        id: initialTabId,
        groupId: initialGroupId,
      },
    },
    tabOrder: [initialTabId],
    activeTabId: initialTabId,
    globalLanes: {},
    groupLanes: {
      [initialGroupId]: {},
    },
    subcontextsByTab: {},
  };
}

export function registerTab(
  state: ShellContextState,
  input: { tabId: string; groupId: string; groupColor?: string },
): ShellContextState {
  const next = cloneContextState(state);
  ensureGroup(next, input.groupId, input.groupColor);
  next.tabs[input.tabId] = {
    id: input.tabId,
    groupId: input.groupId,
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
    groupId: input.targetGroupId,
  };
  return next;
}

export function closeTab(state: ShellContextState, tabId: string): ShellContextState {
  if (!state.tabs[tabId]) {
    return state;
  }

  const next = cloneContextState(state);
  delete next.tabs[tabId];
  next.tabOrder = next.tabOrder.filter((id) => id !== tabId);
  delete next.subcontextsByTab[tabId];
  if (next.activeTabId === tabId) {
    next.activeTabId = next.tabOrder[0] ?? null;
  }
  return next;
}

export function writeGlobalLane(
  state: ShellContextState,
  input: { key: string; value: string; revision: RevisionMeta },
): ShellContextState {
  const current = state.globalLanes[input.key];
  if (!shouldApplyRevision(current?.revision, input.revision)) {
    return state;
  }

  const next = cloneContextState(state);
  next.globalLanes[input.key] = {
    value: input.value,
    revision: input.revision,
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
  input: { groupId: string; key: string; value: string; revision: RevisionMeta; groupColor?: string },
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

export function getTabGroupId(state: ShellContextState, tabId: string): string | null {
  return state.tabs[tabId]?.groupId ?? null;
}

function shouldApplyRevision(current: RevisionMeta | undefined, incoming: RevisionMeta): boolean {
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

function cloneContextState(state: ShellContextState): ShellContextState {
  return {
    groups: { ...state.groups },
    tabs: { ...state.tabs },
    tabOrder: [...state.tabOrder],
    activeTabId: state.activeTabId,
    globalLanes: { ...state.globalLanes },
    groupLanes: Object.fromEntries(
      Object.entries(state.groupLanes).map(([groupId, lanes]) => [groupId, { ...lanes }]),
    ),
    subcontextsByTab: Object.fromEntries(
      Object.entries(state.subcontextsByTab).map(([tabId, lanes]) => [tabId, { ...lanes }]),
    ),
  };
}

function ensureGroup(state: ShellContextState, groupId: string, groupColor?: string): void {
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
