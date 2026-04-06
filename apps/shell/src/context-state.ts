export {
  ContextGroup,
  ContextLaneValue,
  ContextTab,
  ContextTabClosePolicy,
  DerivedLaneDefinition,
  EntityTypeSelection,
  RevisionMeta,
  SelectionPropagationRule,
  SelectionUpdateOptions,
  SelectionUpdateResult,
  SelectionWriteInput,
  ShellContextState,
} from "./context-state/types.js";

export { createInitialShellContextState } from "./context-state/state.js";

export {
  addEntityTypeSelectionId,
  moveEntityTypeSelectionId,
  readEntityTypeSelection,
  removeEntityTypeSelectionId,
  setEntityTypePriority,
  setEntityTypeSelection,
} from "./context-state/selection.js";

export { applySelectionUpdate } from "./context-state/selection-update.js";

export { closeTab, getTabGroupId, moveTabToGroup, registerTab, setActiveTab } from "./context-state/tabs-groups.js";

export {
  readGlobalLane,
  readGroupLaneForTab,
  writeGlobalLane,
  writeGroupLaneByGroup,
  writeGroupLaneByTab,
  writeTabSubcontext,
} from "./context-state/lanes.js";
