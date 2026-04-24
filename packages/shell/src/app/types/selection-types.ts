import type { PluginSelectionContribution } from "@ghost-shell/contracts";
import type {
  ContextTabCloseability,
  DerivedLaneDefinition,
  RevisionMeta,
  SelectionPropagationRule,
  ShellContextState,
} from "../../context-state.js";

export interface RuntimeDerivedLaneContribution {
  id: string;
  key: string;
  sourceEntityType: string;
  scope: "global" | "group";
  valueType: string;
  strategy: "priority-id" | "joined-selected-ids";
}

export interface SelectionGraphExtensions {
  propagationRules: SelectionPropagationRule[];
  derivedLanes: DerivedLaneDefinition[];
}

export interface SelectionPropagationResult {
  state: ShellContextState;
  derivedLaneFailures: string[];
}

export type SelectionWrite = {
  entityType: string;
  selectedIds: string[];
  priorityId: string | null;
};

export type DevLaneMetadata = {
  scope: string;
  key: string;
  value: string;
  revision: RevisionMeta;
  sourceSelection: { entityType: string; revision: RevisionMeta } | undefined;
};

export type RenderTabMetadata = {
  tabId: string;
  groupId: string;
  label: string;
  isActive: boolean;
  closeability: ContextTabCloseability;
};

export type PluginSelectionContrib = PluginSelectionContribution;
