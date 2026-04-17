import type {
  SelectionPropagationResult,
  SelectionWrite,
  ShellRuntime,
} from "../app/types.js";
import { applySelectionUpdate, type RevisionMeta } from "../context-state.js";
import type { SelectionSyncEvent } from "../window-bridge.js";

export function applySelectionPropagation(
  runtime: ShellRuntime,
  event: SelectionSyncEvent,
  revision: RevisionMeta,
): SelectionPropagationResult {
  const writes = resolveSelectionWritesFromEvent(event);
  let next = runtime.contextState;

  for (const write of writes) {
    const result = applySelectionUpdate(next, {
      entityType: write.entityType,
      selectedIds: write.selectedIds,
      priorityId: write.priorityId,
      revision,
    });
    next = result.state;
  }

  return {
    state: next,
  };
}

export function resolveSelectionWritesFromEvent(event: SelectionSyncEvent): SelectionWrite[] {
  return Object.entries(event.selectionByEntityType).map(([entityType, selection]) => {
    const selectedIds = Array.isArray(selection.selectedIds)
      ? selection.selectedIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const priorityId =
      typeof selection.priorityId === "string" && selectedIds.includes(selection.priorityId)
        ? selection.priorityId
        : (selectedIds[0] ?? null);

    return {
      entityType,
      selectedIds,
      priorityId,
    };
  });
}
