export interface RevisionMeta {
  timestamp: number;
  writer: string;
}

export interface ContextLaneValue {
  value: string;
  revision: RevisionMeta;
  valueType?: string;
  sourceSelection?: {
    entityType: string;
    revision: RevisionMeta;
  };
}

export interface ContextGroup {
  id: string;
  color: string;
}

export interface ContextTab {
  id: string;
  groupId: string;
}

export interface EntityTypeSelection {
  selectedIds: string[];
  priorityId: string | null;
}

export interface SelectionWriteInput {
  entityType: string;
  selectedIds: string[];
  priorityId?: string | null;
  revision: RevisionMeta;
}

export interface SelectionPropagationRule {
  id: string;
  sourceEntityType: string;
  propagate: (input: {
    state: ShellContextState;
    sourceEntityType: string;
    sourceSelection: EntityTypeSelection;
    sourceRevision: RevisionMeta;
  }) => Omit<SelectionWriteInput, "revision"> | null;
}

export interface DerivedLaneDefinition {
  key: string;
  valueType: string;
  sourceEntityType: string;
  scope: "global" | "group";
  derive: (input: {
    state: ShellContextState;
    sourceEntityType: string;
    sourceSelection: EntityTypeSelection;
    sourceRevision: RevisionMeta;
  }) => string;
}

export interface SelectionUpdateOptions {
  propagationRules?: SelectionPropagationRule[];
  derivedLanes?: DerivedLaneDefinition[];
  derivedGroupId?: string;
}

export interface SelectionUpdateResult {
  state: ShellContextState;
  changedEntityTypes: string[];
  derivedLaneFailures: string[];
}

export interface ShellContextState {
  groups: Record<string, ContextGroup>;
  tabs: Record<string, ContextTab>;
  tabOrder: string[];
  activeTabId: string | null;
  globalLanes: Record<string, ContextLaneValue>;
  groupLanes: Record<string, Record<string, ContextLaneValue>>;
  subcontextsByTab: Record<string, Record<string, ContextLaneValue>>;
  selectionByEntityType: Record<string, EntityTypeSelection>;
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
    selectionByEntityType: {},
  };
}

export function setEntityTypeSelection(
  state: ShellContextState,
  input: { entityType: string; selectedIds: string[]; priorityId?: string | null },
): ShellContextState {
  const selectedIds = normalizeSelectionIds(input.selectedIds);
  const priorityId = normalizePriorityId(selectedIds, input.priorityId ?? null);
  const current = state.selectionByEntityType[input.entityType];
  if (current && areEqualSelections(current, { selectedIds, priorityId })) {
    return state;
  }

  const next = cloneContextState(state);
  next.selectionByEntityType[input.entityType] = {
    selectedIds,
    priorityId,
  };
  return next;
}

export function addEntityTypeSelectionId(
  state: ShellContextState,
  input: { entityType: string; id: string; index?: number; prioritize?: boolean },
): ShellContextState {
  const current = state.selectionByEntityType[input.entityType] ?? {
    selectedIds: [],
    priorityId: null,
  };

  const without = current.selectedIds.filter((itemId) => itemId !== input.id);
  const nextIds = [...without];
  if (input.index === undefined || input.index < 0 || input.index > nextIds.length) {
    nextIds.push(input.id);
  } else {
    nextIds.splice(input.index, 0, input.id);
  }

  return setEntityTypeSelection(state, {
    entityType: input.entityType,
    selectedIds: nextIds,
    priorityId: input.prioritize ? input.id : current.priorityId,
  });
}

export function removeEntityTypeSelectionId(
  state: ShellContextState,
  input: { entityType: string; id: string },
): ShellContextState {
  const current = state.selectionByEntityType[input.entityType];
  if (!current || !current.selectedIds.includes(input.id)) {
    return state;
  }

  const nextIds = current.selectedIds.filter((itemId) => itemId !== input.id);
  const priorityId = current.priorityId === input.id ? nextIds[0] ?? null : current.priorityId;
  return setEntityTypeSelection(state, {
    entityType: input.entityType,
    selectedIds: nextIds,
    priorityId,
  });
}

export function moveEntityTypeSelectionId(
  state: ShellContextState,
  input: { entityType: string; id: string; toIndex: number },
): ShellContextState {
  const current = state.selectionByEntityType[input.entityType];
  if (!current) {
    return state;
  }

  const fromIndex = current.selectedIds.indexOf(input.id);
  if (fromIndex < 0) {
    return state;
  }

  const boundedIndex = Math.min(Math.max(input.toIndex, 0), current.selectedIds.length - 1);
  if (boundedIndex === fromIndex) {
    return state;
  }

  const nextIds = [...current.selectedIds];
  nextIds.splice(fromIndex, 1);
  nextIds.splice(boundedIndex, 0, input.id);

  return setEntityTypeSelection(state, {
    entityType: input.entityType,
    selectedIds: nextIds,
    priorityId: current.priorityId,
  });
}

export function setEntityTypePriority(
  state: ShellContextState,
  input: { entityType: string; priorityId: string | null },
): ShellContextState {
  const current = state.selectionByEntityType[input.entityType] ?? {
    selectedIds: [],
    priorityId: null,
  };

  return setEntityTypeSelection(state, {
    entityType: input.entityType,
    selectedIds: current.selectedIds,
    priorityId: input.priorityId,
  });
}

export function readEntityTypeSelection(
  state: ShellContextState,
  entityType: string,
): EntityTypeSelection {
  const current = state.selectionByEntityType[entityType];
  if (!current) {
    return {
      selectedIds: [],
      priorityId: null,
    };
  }

  return {
    selectedIds: [...current.selectedIds],
    priorityId: current.priorityId,
  };
}

export function applySelectionUpdate(
  state: ShellContextState,
  input: SelectionWriteInput,
  options?: SelectionUpdateOptions,
): SelectionUpdateResult {
  const propagationRules = [...(options?.propagationRules ?? [])].sort((a, b) =>
    compareDeterministicKeys(a.id, b.id),
  );
  const derivedLanes = [...(options?.derivedLanes ?? [])].sort((a, b) =>
    compareDeterministicKeys(`${a.scope}:${a.key}`, `${b.scope}:${b.key}`),
  );

  const queue: string[] = [input.entityType];
  const pendingByEntityType = new Map<string, SelectionWriteInput>([
    [
      input.entityType,
      {
        entityType: input.entityType,
        selectedIds: input.selectedIds,
        priorityId: input.priorityId ?? null,
        revision: input.revision,
      },
    ],
  ]);
  const changedEntityTypes: string[] = [];
  const revisionByEntityType = new Map<string, RevisionMeta>();
  let next = state;

  while (queue.length > 0) {
    const entityType = queue.shift() as string;
    const item = pendingByEntityType.get(entityType);
    if (!item) {
      continue;
    }
    pendingByEntityType.delete(entityType);

    const updated = setEntityTypeSelection(next, {
      entityType: item.entityType,
      selectedIds: item.selectedIds,
      priorityId: item.priorityId ?? null,
    });
    const didChange = updated !== next;
    next = updated;

    if (!didChange) {
      continue;
    }

    if (!changedEntityTypes.includes(item.entityType)) {
      changedEntityTypes.push(item.entityType);
    }
    revisionByEntityType.set(item.entityType, item.revision);

    const sourceSelection = readEntityTypeSelection(next, item.entityType);
    for (const rule of propagationRules) {
      if (rule.sourceEntityType !== item.entityType) {
        continue;
      }

      let propagated: Omit<SelectionWriteInput, "revision"> | null = null;
      try {
        propagated = rule.propagate({
          state: next,
          sourceEntityType: item.entityType,
          sourceSelection,
          sourceRevision: item.revision,
        });
      } catch {
        propagated = null;
      }

      if (!propagated) {
        continue;
      }

      const targetCurrent = readEntityTypeSelection(next, propagated.entityType);
      const targetNext = {
        selectedIds: normalizeSelectionIds(propagated.selectedIds),
        priorityId: normalizePriorityId(
          normalizeSelectionIds(propagated.selectedIds),
          propagated.priorityId ?? null,
        ),
      };

      if (areEqualSelections(targetCurrent, targetNext)) {
        continue;
      }

      if (!pendingByEntityType.has(propagated.entityType)) {
        queue.push(propagated.entityType);
      }
      pendingByEntityType.set(propagated.entityType, {
        entityType: propagated.entityType,
        selectedIds: targetNext.selectedIds,
        priorityId: targetNext.priorityId,
        revision: item.revision,
      });
    }
  }

  const derivedLaneFailures: string[] = [];
  for (const lane of derivedLanes) {
    const sourceRevision = revisionByEntityType.get(lane.sourceEntityType);
    if (!sourceRevision) {
      continue;
    }

    const sourceSelection = readEntityTypeSelection(next, lane.sourceEntityType);
    let laneValue: string;
    try {
      laneValue = lane.derive({
        state: next,
        sourceEntityType: lane.sourceEntityType,
        sourceSelection,
        sourceRevision,
      });
    } catch {
      derivedLaneFailures.push(lane.key);
      continue;
    }

    if (lane.scope === "global") {
      next = writeGlobalLane(next, {
        key: lane.key,
        value: laneValue,
        revision: sourceRevision,
        valueType: lane.valueType,
        sourceSelection: {
          entityType: lane.sourceEntityType,
          revision: sourceRevision,
        },
      });
      continue;
    }

    const groupId = options?.derivedGroupId;
    if (!groupId) {
      continue;
    }

    next = writeGroupLaneByGroup(next, {
      groupId,
      key: lane.key,
      value: laneValue,
      revision: sourceRevision,
      valueType: lane.valueType,
      sourceSelection: {
        entityType: lane.sourceEntityType,
        revision: sourceRevision,
      },
    });
  }

  return {
    state: next,
    changedEntityTypes,
    derivedLaneFailures,
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

function compareDeterministicKeys(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
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
    selectionByEntityType: Object.fromEntries(
      Object.entries(state.selectionByEntityType).map(([entityType, selection]) => [
        entityType,
        {
          selectedIds: [...selection.selectedIds],
          priorityId: selection.priorityId,
        },
      ]),
    ),
  };
}

function normalizeSelectionIds(input: string[]): string[] {
  const deduped = new Set<string>();
  for (const id of input) {
    if (id) {
      deduped.add(id);
    }
  }
  return [...deduped];
}

function normalizePriorityId(selectedIds: string[], priorityId: string | null): string | null {
  if (!priorityId) {
    return selectedIds[0] ?? null;
  }

  if (!selectedIds.includes(priorityId)) {
    return selectedIds[0] ?? null;
  }

  return priorityId;
}

function areEqualSelections(a: EntityTypeSelection, b: EntityTypeSelection): boolean {
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
