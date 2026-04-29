export {
  DEFAULT_PLACEMENT_CONFIG,
  DWINDLE_DIRECTION_CONFIG_KEY,
  PLACEMENT_STRATEGY_CONFIG_KEY,
} from "./config.js";
export { createDwindlePlacementStrategy } from "./dwindle.js";
export type { PlacementStrategyRegistry } from "./registry.js";
export { createPlacementStrategyRegistry } from "./registry.js";
export { initPlacementStrategy } from "./setup.js";
export { createStackPlacementStrategy } from "./stack.js";
export { createTabsPlacementStrategy } from "./tabs.js";
export type {
  DwindleSplitDirection,
  PlacementConfig,
  PlacementContext,
  PlacementResult,
  PlacementStrategyId,
  TabPlacementStrategy,
} from "./types.js";
