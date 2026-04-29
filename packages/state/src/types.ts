import type { DockTreeState } from "./dock-tree-types.js";

export type PanelId = string;

export type TabInstanceId = string;

export interface RevisionMeta {
  timestamp: number;
  writer: string;
}

export interface ContextLaneValue {
  value: string;
  revision: RevisionMeta;
  valueType?: string;
  sourceSelection?: {
    entityType: string;
    revision: RevisionMeta;
  };
}

export interface ContextGroup {
  id: string;
  color: string;
}

export interface ContextTab {
  id: string;
  definitionId: string;
  partDefinitionId?: string;
  groupId: string;
  label: string;
  closePolicy: ContextTabClosePolicy;
  args: Record<string, string>;
}

export type ContextTabSlot = "main" | "secondary" | "side";

export interface ClosedTabHistoryEntry {
  tabId: string;
  definitionId?: string;
  args?: Record<string, string>;
  partDefinitionId?: string;
  groupId: string;
  label: string;
  closePolicy: ContextTabClosePolicy;
  slot: ContextTabSlot;
  orderIndex?: number;
}

export type ContextTabClosePolicy = "fixed" | "closeable";

export type ContextTabCloseActionAvailability = "disabled" | "enabled";

export interface ContextTabCloseability {
  policy: ContextTabClosePolicy;
  canClose: boolean;
  actionAvailability: ContextTabCloseActionAvailability;
  reason: "fixed-policy" | null;
}

export interface EntityTypeSelection {
  selectedIds: string[];
  priorityId: string | null;
}

export interface SelectionWriteInput {
  entityType: string;
  selectedIds: string[];
  priorityId?: string | null;
  revision: RevisionMeta;
}

export interface SelectionPropagationRule {
  id: string;
  sourceEntityType: string;
  propagate: (input: {
    state: ShellContextState;
    sourceEntityType: string;
    sourceSelection: EntityTypeSelection;
    sourceRevision: RevisionMeta;
  }) => Omit<SelectionWriteInput, "revision"> | null;
}

export interface DerivedLaneDefinition {
  key: string;
  valueType: string;
  sourceEntityType: string;
  scope: "global" | "group";
  derive: (input: {
    state: ShellContextState;
    sourceEntityType: string;
    sourceSelection: EntityTypeSelection;
    sourceRevision: RevisionMeta;
  }) => string;
}

export interface SelectionUpdateOptions {
  propagationRules?: SelectionPropagationRule[];
  derivedLanes?: DerivedLaneDefinition[];
  derivedGroupId?: string;
}

export interface SelectionUpdateResult {
  state: ShellContextState;
  changedEntityTypes: string[];
  derivedLaneFailures: string[];
}

export interface ShellContextState {
  groups: Record<string, ContextGroup>;
  tabs: Record<string, ContextTab>;
  tabOrder: TabInstanceId[];
  activeTabId: TabInstanceId | null;
  dockTree: DockTreeState;
  closedTabHistory: ClosedTabHistoryEntry[];
  globalLanes: Record<string, ContextLaneValue>;
  groupLanes: Record<string, Record<string, ContextLaneValue>>;
  subcontextsByTab: Record<string, Record<string, ContextLaneValue>>;
  selectionByEntityType: Record<string, EntityTypeSelection>;
}
