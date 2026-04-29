import { compareDeterministicKeys, normalizePriorityId, normalizeSelectionIds } from "./helpers.js";
import { writeGlobalLane, writeGroupLaneByGroup } from "./lanes.js";
import { readEntityTypeSelection, setEntityTypeSelection } from "./selection.js";
import type { SelectionUpdateOptions, SelectionUpdateResult, SelectionWriteInput, ShellContextState } from "./types.js";

type PropagationRule = NonNullable<SelectionUpdateOptions["propagationRules"]>[number];
type DerivedLane = NonNullable<SelectionUpdateOptions["derivedLanes"]>[number];

export function applySelectionUpdate(
  state: ShellContextState,
  input: SelectionWriteInput,
  options?: SelectionUpdateOptions,
): SelectionUpdateResult {
  const propagationRules = [...(options?.propagationRules ?? [])].sort((a, b) => compareDeterministicKeys(a.id, b.id));
  const derivedLanes = [...(options?.derivedLanes ?? [])].sort((a, b) =>
    compareDeterministicKeys(`${a.scope}:${a.key}`, `${b.scope}:${b.key}`),
  );

  const {
    next: propagatedState,
    changedEntityTypes,
    revisionByEntityType,
  } = propagateSelections(state, input, propagationRules);

  const { next: finalState, derivedLaneFailures } = applyDerivedLanes(
    propagatedState,
    derivedLanes,
    revisionByEntityType,
    options?.derivedGroupId,
  );

  return {
    state: finalState,
    changedEntityTypes,
    derivedLaneFailures,
  };
}

function propagateSelections(
  state: ShellContextState,
  input: SelectionWriteInput,
  propagationRules: PropagationRule[],
): {
  next: ShellContextState;
  changedEntityTypes: string[];
  revisionByEntityType: Map<string, SelectionWriteInput["revision"]>;
} {
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
  const revisionByEntityType = new Map<string, SelectionWriteInput["revision"]>();
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

    enqueuePropagatedSelections(next, item, propagationRules, pendingByEntityType, queue);
  }

  return { next, changedEntityTypes, revisionByEntityType };
}

function enqueuePropagatedSelections(
  state: ShellContextState,
  item: SelectionWriteInput,
  propagationRules: readonly PropagationRule[],
  pendingByEntityType: Map<string, SelectionWriteInput>,
  queue: string[],
): void {
  const sourceSelection = readEntityTypeSelection(state, item.entityType);
  for (const rule of propagationRules) {
    if (rule.sourceEntityType !== item.entityType) {
      continue;
    }

    let propagated: Omit<SelectionWriteInput, "revision"> | null = null;
    try {
      propagated = rule.propagate({
        state,
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

    const targetCurrent = readEntityTypeSelection(state, propagated.entityType);
    const targetNext = {
      selectedIds: normalizeSelectionIds(propagated.selectedIds),
      priorityId: normalizePriorityId(normalizeSelectionIds(propagated.selectedIds), propagated.priorityId ?? null),
    };

    if (
      targetCurrent.priorityId === targetNext.priorityId &&
      targetCurrent.selectedIds.length === targetNext.selectedIds.length &&
      targetCurrent.selectedIds.every((id, idx) => id === targetNext.selectedIds[idx])
    ) {
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

function applyDerivedLanes(
  state: ShellContextState,
  derivedLanes: readonly DerivedLane[],
  revisionByEntityType: Map<string, SelectionWriteInput["revision"]>,
  derivedGroupId: string | undefined,
): { next: ShellContextState; derivedLaneFailures: string[] } {
  const derivedLaneFailures: string[] = [];
  let next = state;

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

    const groupId = derivedGroupId;
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

  return { next, derivedLaneFailures };
}
