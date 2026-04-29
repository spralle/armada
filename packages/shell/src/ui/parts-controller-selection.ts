import type { ShellRuntime } from "../app/types.js";
import { createRevision, writeGlobalSelectionLane } from "../context/runtime-state.js";
import { buildSelectionEnvelope } from "./parts-controller-selection-transition.js";
import type { PartsControllerDeps } from "./parts-controller-types.js";

export function activateTabThroughRuntime(
  runtime: ShellRuntime,
  partId: string,
  partTitle: string,
  deps: PartsControllerDeps,
): void {
  const selectionRevision = createRevision(runtime.windowId);
  const selectedPartDefinitionId =
    runtime.contextState.tabs[partId]?.partDefinitionId ?? runtime.contextState.tabs[partId]?.definitionId ?? partId;

  const selectionEvent = buildSelectionEnvelope(runtime.contextState, {
    selectedPartId: partId,
    selectedPartTitle: partTitle,
    revision: selectionRevision,
    sourceWindowId: runtime.windowId,
    selectedPartDefinitionId,
  });

  deps.applySelection(selectionEvent);

  deps.publishWithDegrade(selectionEvent);

  writeGlobalSelectionLane(runtime, {
    selectedPartId: partId,
    selectedPartTitle: partTitle,
    revision: selectionRevision,
  });
}
