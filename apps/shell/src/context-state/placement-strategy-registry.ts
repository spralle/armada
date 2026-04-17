import type {
  PlacementConfig,
  PlacementStrategyId,
  TabPlacementStrategy,
} from "./placement-strategy-types.js";

export interface PlacementStrategyRegistry {
  register(strategy: TabPlacementStrategy): void;
  get(id: PlacementStrategyId): TabPlacementStrategy | undefined;
  getActive(config: PlacementConfig): TabPlacementStrategy;
  list(): TabPlacementStrategy[];
}

export function createPlacementStrategyRegistry(): PlacementStrategyRegistry {
  const strategies = new Map<PlacementStrategyId, TabPlacementStrategy>();

  return {
    register(strategy: TabPlacementStrategy): void {
      if (strategies.has(strategy.id)) {
        console.warn(`[PlacementStrategyRegistry] Overwriting existing strategy '${strategy.id}'`);
      }
      strategies.set(strategy.id, strategy);
    },

    get(id: PlacementStrategyId): TabPlacementStrategy | undefined {
      return strategies.get(id);
    },

    getActive(config: PlacementConfig): TabPlacementStrategy {
      const strategy = strategies.get(config.strategy);
      if (strategy) {
        return strategy;
      }
      const fallback = strategies.get("tabs");
      if (!fallback) {
        throw new Error("No placement strategies registered; 'tabs' fallback is missing");
      }
      return fallback;
    },

    list(): TabPlacementStrategy[] {
      return [...strategies.values()];
    },
  };
}
