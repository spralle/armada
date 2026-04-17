import { setEntityTypeSelection } from "./selection.js";
import {
  SelectionUpdateResult,
  SelectionWriteInput,
  ShellContextState,
} from "./types.js";

export function applySelectionUpdate(
  state: ShellContextState,
  input: SelectionWriteInput,
): SelectionUpdateResult {
  const updated = setEntityTypeSelection(state, {
    entityType: input.entityType,
    selectedIds: input.selectedIds,
    priorityId: input.priorityId ?? null,
  });
  const didChange = updated !== state;

  return {
    state: updated,
    changedEntityTypes: didChange ? [input.entityType] : [],
  };
}
