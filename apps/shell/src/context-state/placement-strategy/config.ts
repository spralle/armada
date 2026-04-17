import type { PlacementConfig } from "./types.js";

export const PLACEMENT_STRATEGY_CONFIG_KEY = "ghost.shell.placement.strategy";
export const DWINDLE_DIRECTION_CONFIG_KEY = "ghost.shell.placement.dwindleDirection";

export const DEFAULT_PLACEMENT_CONFIG: PlacementConfig = {
  strategy: "tabs",
  dwindleDirection: "alternate",
};
