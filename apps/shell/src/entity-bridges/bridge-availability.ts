import type { ActiveBridge } from "./broker-types.js";

/**
 * Build bridge availability context entries for action predicate evaluation.
 * Returns entries like `{ "bridge.available.order": "true" }` for each entity type
 * that has at least one activated bridge targeting or sourcing from it.
 */
export function buildBridgeAvailabilityContext(
  activeBridges: ReadonlyArray<ActiveBridge>,
): Record<string, string> {
  const context: Record<string, string> = {};
  for (const bridge of activeBridges) {
    if (bridge.status === "activated") {
      context[`bridge.available.${bridge.targetEntityType}`] = "true";
      context[`bridge.available.${bridge.sourceEntityType}`] = "true";
    }
  }
  return context;
}
