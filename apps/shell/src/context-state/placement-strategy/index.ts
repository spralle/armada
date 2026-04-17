export type {
  PlacementStrategyId,
  DwindleSplitDirection,
  PlacementConfig,
  PlacementContext,
  PlacementResult,
  TabPlacementStrategy,
} from "./types.js";

export type { PlacementStrategyRegistry } from "./registry.js";
export { createPlacementStrategyRegistry } from "./registry.js";

export {
  DEFAULT_PLACEMENT_CONFIG,
  PLACEMENT_STRATEGY_CONFIG_KEY,
  DWINDLE_DIRECTION_CONFIG_KEY,
} from "./config.js";

export { createTabsPlacementStrategy } from "./tabs.js";
export { createDwindlePlacementStrategy } from "./dwindle.js";
export { createStackPlacementStrategy } from "./stack.js";

export { initPlacementStrategy } from "./setup.js";
