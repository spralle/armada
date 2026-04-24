import type { ContextSyncEvent, SelectionSyncEvent } from "./window-bridge.js";

export function buildSelectionSyncEvent(input: {
  selectedPartId: string;
  selectedPartTitle: string;
  selectionByEntityType: SelectionSyncEvent["selectionByEntityType"];
  revision?: SelectionSyncEvent["revision"];
  sourceWindowId: string;
  selectedPartInstanceId?: string;
  selectedPartDefinitionId?: string;
}): SelectionSyncEvent {
  return {
    type: "selection",
    selectedPartId: input.selectedPartId,
    selectedPartTitle: input.selectedPartTitle,
    selectionByEntityType: input.selectionByEntityType,
    revision: input.revision,
    sourceWindowId: input.sourceWindowId,
    selectedPartInstanceId: input.selectedPartInstanceId ?? input.selectedPartId,
    selectedPartDefinitionId: input.selectedPartDefinitionId ?? input.selectedPartId,
  };
}

export function buildGroupContextSyncEvent(input: {
  tabId?: string;
  groupId?: string;
  contextKey: string;
  contextValue: string;
  revision?: ContextSyncEvent["revision"];
  sourceWindowId: string;
  tabInstanceId?: string;
  partInstanceId?: string;
  partDefinitionId?: string;
}): ContextSyncEvent {
  return {
    type: "context",
    scope: "group",
    tabId: input.tabId,
    tabInstanceId: input.tabInstanceId ?? input.tabId,
    partInstanceId: input.partInstanceId ?? input.tabId,
    partDefinitionId: input.partDefinitionId,
    groupId: input.groupId,
    contextKey: input.contextKey,
    contextValue: input.contextValue,
    revision: input.revision,
    sourceWindowId: input.sourceWindowId,
  };
}
