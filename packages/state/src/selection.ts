import { areEqualSelections, cloneContextState, normalizePriorityId, normalizeSelectionIds } from "./helpers.js";
import { EntityTypeSelection, ShellContextState } from "./types.js";

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
