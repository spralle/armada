import { buildSelectionSyncEvent } from "@ghost-shell/bridge";
import type { BridgeHost, ShellRuntime } from "../app/types.js";
import { createRevision, writeGlobalSelectionLane } from "../context/runtime-state.js";
import { buildSelectionByEntityType } from "./parts-controller-selection-transition.js";

export interface SelectionEffectDeps {
  applySelection: (event: import("@ghost-shell/bridge").SelectionSyncEvent) => void;
  publishWithDegrade: (event: Parameters<BridgeHost["bridge"]["publish"]>[0]) => void;
}

export function applySelectionForTab(
  runtime: ShellRuntime,
  tabId: string,
  tabTitle: string,
  deps: SelectionEffectDeps,
): void {
  const revision = createRevision(runtime.windowId);
  const selectionByEntityType = buildSelectionByEntityType(runtime.contextState);

  const selectionEvent = buildSelectionSyncEvent({
    selectedPartId: tabId,
    selectedPartTitle: tabTitle,
    selectionByEntityType,
    revision,
    sourceWindowId: runtime.windowId,
    selectedPartDefinitionId:
      runtime.contextState.tabs[tabId]?.partDefinitionId ?? runtime.contextState.tabs[tabId]?.definitionId ?? tabId,
  });

  deps.applySelection(selectionEvent);
  deps.publishWithDegrade(selectionEvent);
  writeGlobalSelectionLane(runtime, {
    selectedPartId: tabId,
    selectedPartTitle: tabTitle,
    revision,
  });
}
