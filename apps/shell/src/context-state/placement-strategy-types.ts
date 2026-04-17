import type { DockTreeState } from "./dock-tree-types.js";

export type PlacementStrategyId = "tabs" | "dwindle" | "stack";

export type DwindleSplitDirection = "alternate" | "horizontal" | "vertical";

export interface PlacementConfig {
  strategy: PlacementStrategyId;
  dwindleDirection: DwindleSplitDirection;
}

export interface PlacementContext {
  tabId: string;
  tree: DockTreeState;
  activeStackId?: string;
  dwindleDirection?: DwindleSplitDirection;
}

export interface PlacementResult {
  tree: DockTreeState;
  targetStackId: string;
}

export interface TabPlacementStrategy {
  readonly id: PlacementStrategyId;
  place(ctx: PlacementContext): PlacementResult;
  onTabClosed?(ctx: { tabId: string; stackId: string; tree: DockTreeState }): DockTreeState;
  navigateBack?(stackId: string, tree: DockTreeState): { tree: DockTreeState; activatedTabId?: string } | null;
  navigateForward?(stackId: string, tree: DockTreeState): { tree: DockTreeState; activatedTabId?: string } | null;
}
