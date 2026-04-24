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
} from "./types.js";

export type {
  DockDirection,
  DockDropZone,
  DockNode,
  DockOrientation,
  DockSplitNode,
  DockStackNode,
  DockTabDropInput,
  DockTreeState,
} from "./dock-tree-types.js";

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
} from "./dock-tree.js";

export { setDockSplitRatio } from "./dock-tree-ratio.js";

export {
  focusActiveTabInDirection,
  focusAdjacentTabInActiveStack,
  moveActiveTabInDirection,
  moveActiveTabToDirectionalGroup,
  resizeNearestSplitInDirection,
  swapActiveTabInDirection,
} from "./dock-tree-commands.js";

export { createInitialShellContextState } from "./state.js";

export {
  addEntityTypeSelectionId,
  moveEntityTypeSelectionId,
  readEntityTypeSelection,
  removeEntityTypeSelectionId,
  setEntityTypePriority,
  setEntityTypeSelection,
} from "./selection.js";

export { applySelectionUpdate } from "./selection-update.js";

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
} from "./tabs-groups.js";

export {
  absorbStackInDirection,
  cycleTabGroup,
  cycleTabInActiveStack,
  detachTabInDirection,
  equalizeSplits,
  explodeActiveStack,
  focusTabInDirection,
  gotoTabByIndex,
  moveTabInDirection,
  navigateBackInActiveStack,
  navigateForwardInActiveStack,
  reorderActiveTabInStack,
  resizeInDirection,
  swapTabInDirection,
} from "./window-management.js";

export type {
  IncomingTransferJournal,
  IncomingTransferTab,
  IncomingTransferTarget,
  IncomingTransferTransactionInput,
  IncomingTransferTransactionResult,
} from "./incoming-transfer-transaction.js";

export {
  applyIncomingTransferTransaction,
  createIncomingTransferJournal,
} from "./incoming-transfer-transaction.js";

export {
  closeTabIfAllowed,
  closeTabIfAllowedWithHistory,
  getTabCloseability,
  getTabGroupId,
} from "./tabs-groups-closeability.js";

export {
  readGlobalLane,
  readGroupLaneForTab,
  writeGlobalLane,
  writeGroupLaneByGroup,
  writeGroupLaneByTab,
  writeTabSubcontext,
} from "./lanes.js";

export type {
  Workspace,
  WorkspaceManagerState,
  WorkspaceOperationResult,
  WorkspaceSwitchResult,
} from "./workspace-types.js";

export {
  createInitialWorkspaceManagerState,
  createWorkspace,
  deleteWorkspace,
  moveTabToWorkspace,
  renameWorkspace,
  reorderWorkspace,
  switchWorkspace,
} from "./workspace.js";

export type {
  TabPlacementStrategy,
  PlacementConfig,
} from "./placement-strategy/types.js";

export type {
  PlacementStrategyRegistry,
} from "./placement-strategy/registry.js";

export {
  initPlacementStrategy,
} from "./placement-strategy/setup.js";

export {
  createPlacementStrategyRegistry,
} from "./placement-strategy/registry.js";

export {
  createTabsPlacementStrategy,
} from "./placement-strategy/tabs.js";

export {
  createDwindlePlacementStrategy,
} from "./placement-strategy/dwindle.js";

export {
  createStackPlacementStrategy,
} from "./placement-strategy/stack.js";

export {
  DEFAULT_PLACEMENT_CONFIG,
  PLACEMENT_STRATEGY_CONFIG_KEY,
  DWINDLE_DIRECTION_CONFIG_KEY,
} from "./placement-strategy/config.js";

export type {
  ShellLayoutState,
  PartialLayoutState,
  PaneResizeRequest,
  EdgeSlotState,
  ShellEdgeSlotsLayout,
} from "./layout.js";

export {
  createDefaultLayoutState,
  sanitizeLayoutState,
  applyPaneResize,
  createDefaultEdgeSlotsLayout,
} from "./layout.js";
