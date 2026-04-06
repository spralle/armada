export {
  ContextGroup,
  ContextLaneValue,
  ContextTab,
  ContextTabCloseActionAvailability,
  ContextTabCloseability,
  ContextTabClosePolicy,
  ContextTabSlot,
  ClosedTabHistoryEntry,
  DerivedLaneDefinition,
  EntityTypeSelection,
  PanelId,
  RevisionMeta,
  SelectionPropagationRule,
  SelectionUpdateOptions,
  SelectionUpdateResult,
  SelectionWriteInput,
  ShellContextState,
  TabInstanceId,
} from "./context-state/types.js";

export type {
  DockDropZone,
  DockNode,
  DockOrientation,
  DockSplitNode,
  DockStackNode,
  DockTabDropInput,
  DockTreeState,
} from "./context-state/dock-tree-types.js";

export {
  applyDockTabDrop,
  activateTabInDockTree,
  createInitialDockTree,
  deriveDeterministicActiveTabId,
  ensureTabRegisteredInDockTree,
  moveTabWithinDockTree,
  removeTabFromDockTree,
} from "./context-state/dock-tree.js";

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

export {
  closeTab,
  closeTabIfAllowed,
  closeTabIfAllowedWithHistory,
  closeTabWithHistory,
  canReopenClosedTab,
  getTabCloseability,
  getTabGroupId,
  moveTabInDockTree,
  moveTabToGroup,
  reopenMostRecentlyClosedTab,
  registerTab,
  setActiveTab,
} from "./context-state/tabs-groups.js";

export {
  readGlobalLane,
  readGroupLaneForTab,
  writeGlobalLane,
  writeGroupLaneByGroup,
  writeGroupLaneByTab,
  writeTabSubcontext,
} from "./context-state/lanes.js";
