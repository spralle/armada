import { createPlacementStrategyRegistry } from "./registry.js";
import { createTabsPlacementStrategy } from "./tabs.js";
import { createDwindlePlacementStrategy } from "./dwindle.js";
import { createStackPlacementStrategy } from "./stack.js";
import { DEFAULT_PLACEMENT_CONFIG } from "./config.js";
import type { PlacementStrategyRegistry } from "./registry.js";
import type { PlacementConfig } from "./types.js";

export function initPlacementStrategy(): { registry: PlacementStrategyRegistry; config: PlacementConfig } {
  const registry = createPlacementStrategyRegistry();
  registry.register(createTabsPlacementStrategy());
  registry.register(createDwindlePlacementStrategy());
  registry.register(createStackPlacementStrategy());
  return { registry, config: DEFAULT_PLACEMENT_CONFIG };
}
