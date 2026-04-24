export type {
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
} from "@ghost-shell/state";

export type {
  DockDirection,
  DockDropZone,
  DockNode,
  DockOrientation,
  DockSplitNode,
  DockStackNode,
  DockTabDropInput,
  DockTreeState,
} from "@ghost-shell/state";

export {
  applyDockTabDrop,
  activateTabInDockTree,
  createInitialDockTree,
  deriveDeterministicActiveTabId,
  ensureTabRegisteredInDockTree,
  moveTabWithinDockTree,
  readDockSplitRatio,
  removeTabFromDockTree,
  setDockSplitRatioById,
} from "@ghost-shell/state";

export { setDockSplitRatio } from "@ghost-shell/state";

export {
  focusActiveTabInDirection,
  focusAdjacentTabInActiveStack,
  moveActiveTabInDirection,
  moveActiveTabToDirectionalGroup,
  resizeNearestSplitInDirection,
  swapActiveTabInDirection,
} from "@ghost-shell/state";

export { createInitialShellContextState } from "@ghost-shell/state";

export {
  addEntityTypeSelectionId,
  moveEntityTypeSelectionId,
  readEntityTypeSelection,
  removeEntityTypeSelectionId,
  setEntityTypePriority,
  setEntityTypeSelection,
} from "@ghost-shell/state";

export { applySelectionUpdate } from "@ghost-shell/state";

export {
  closeTab,
  moveTabInDockTree,
  moveTabBeforeTab,
  moveTabToGroup,
  openPartInstance,
  closeTabWithHistory,
  canReopenClosedTab,
  reopenMostRecentlyClosedTab,
  registerTab,
  setActiveTab,
} from "@ghost-shell/state";

export {
  cycleTabGroup,
  cycleTabInActiveStack,
  equalizeSplits,
  focusTabInDirection,
  gotoTabByIndex,
  moveTabInDirection,
  resizeInDirection,
  swapTabInDirection,
} from "@ghost-shell/state";

export type {
  IncomingTransferJournal,
  IncomingTransferTab,
  IncomingTransferTarget,
  IncomingTransferTransactionInput,
  IncomingTransferTransactionResult,
} from "@ghost-shell/state";

export {
  applyIncomingTransferTransaction,
  createIncomingTransferJournal,
} from "@ghost-shell/state";

export {
  closeTabIfAllowed,
  closeTabIfAllowedWithHistory,
  getTabCloseability,
  getTabGroupId,
} from "@ghost-shell/state";

export {
  readGlobalLane,
  readGroupLaneForTab,
  writeGlobalLane,
  writeGroupLaneByGroup,
  writeGroupLaneByTab,
  writeTabSubcontext,
} from "@ghost-shell/state";
