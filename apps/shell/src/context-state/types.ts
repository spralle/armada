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
  partDefinitionId: string;
  groupId: string;
  label: string;
  closePolicy: ContextTabClosePolicy;
}

export type ContextTabSlot = "main" | "secondary" | "side";

export interface ClosedTabHistoryEntry {
  tabId: string;
  partDefinitionId: string;
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
  tabOrder: string[];
  activeTabId: string | null;
  closedTabHistoryBySlot: Record<ContextTabSlot, ClosedTabHistoryEntry[]>;
  globalLanes: Record<string, ContextLaneValue>;
  groupLanes: Record<string, Record<string, ContextLaneValue>>;
  subcontextsByTab: Record<string, Record<string, ContextLaneValue>>;
  selectionByEntityType: Record<string, EntityTypeSelection>;
}
