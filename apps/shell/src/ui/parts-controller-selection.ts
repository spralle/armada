import { createRevision, writeGlobalSelectionLane } from "../context/runtime-state.js";
import { readEntityTypeSelection } from "../context-state.js";
import type { ShellRuntime } from "../app/types.js";
import type { PartsControllerDeps } from "./parts-controller-types.js";

export function activateTabThroughRuntime(
  runtime: ShellRuntime,
  partId: string,
  partTitle: string,
  deps: PartsControllerDeps,
): void {
  const selectionRevision = createRevision(runtime.windowId);
  const selectionByEntityType = Object.fromEntries(
    Object.keys(runtime.contextState.selectionByEntityType).map((entityType) => [
      entityType,
      readEntityTypeSelection(runtime.contextState, entityType),
    ]),
  );

  deps.applySelection({
    selectedPartId: partId,
    selectedPartTitle: partTitle,
    selectionByEntityType,
    revision: selectionRevision,
    sourceWindowId: runtime.windowId,
    type: "selection",
  });

  deps.publishWithDegrade({
    type: "selection",
    selectedPartId: partId,
    selectedPartTitle: partTitle,
    selectionByEntityType,
    revision: selectionRevision,
    sourceWindowId: runtime.windowId,
  });

  writeGlobalSelectionLane(runtime, {
    selectedPartId: partId,
    selectedPartTitle: partTitle,
    revision: selectionRevision,
  });
}
