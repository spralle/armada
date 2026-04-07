import { readEntityTypeSelection, type ShellContextState } from "../context-state.js";
import type { SelectionSyncEvent } from "../window-bridge.js";

interface SelectionEnvelopeInput {
  selectedPartId: string;
  selectedPartTitle: string;
  sourceWindowId: string;
  revision: NonNullable<SelectionSyncEvent["revision"]>;
  selectedPartDefinitionId?: string;
}

export function buildSelectionByEntityType(
  state: ShellContextState,
): SelectionSyncEvent["selectionByEntityType"] {
  return Object.fromEntries(
    Object.keys(state.selectionByEntityType).map((entityType) => [
      entityType,
      readEntityTypeSelection(state, entityType),
    ]),
  );
}

export function buildSelectionEnvelope(
  state: ShellContextState,
  input: SelectionEnvelopeInput,
): SelectionSyncEvent {
  return {
    type: "selection",
    selectedPartId: input.selectedPartId,
    selectedPartTitle: input.selectedPartTitle,
    selectionByEntityType: buildSelectionByEntityType(state),
    revision: input.revision,
    sourceWindowId: input.sourceWindowId,
    selectedPartInstanceId: input.selectedPartId,
    selectedPartDefinitionId: input.selectedPartDefinitionId ?? input.selectedPartId,
  };
}
