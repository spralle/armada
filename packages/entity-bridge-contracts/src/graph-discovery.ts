import type {
  PluginEntityBridgeContribution,
  EntityReachabilityEdge,
  EntityReachabilityMap,
} from "./types.js";

/**
 * Walk bridge declarations using BFS to compute all entity types reachable
 * from `sourceEntityType`. Edges that would revisit an already-visited entity
 * type are annotated with `isCyclic: true` but not re-queued, guaranteeing
 * termination even for cyclic graphs.
 */
export function discoverReachable(
  bridges: ReadonlyArray<PluginEntityBridgeContribution>,
  sourceEntityType: string,
): EntityReachabilityMap {
  const edges: EntityReachabilityEdge[] = [];
  const visited = new Set<string>([sourceEntityType]);

  // BFS queue: each entry is an entity type to expand, paired with its depth
  const queue: Array<{ entityType: string; depth: number }> = [
    { entityType: sourceEntityType, depth: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const bridge of bridges) {
      if (bridge.sourceEntityType !== current.entityType) {
        continue;
      }

      const targetDepth = current.depth + 1;
      const isCyclic = visited.has(bridge.targetEntityType);

      edges.push({
        sourceEntityType: bridge.sourceEntityType,
        targetEntityType: bridge.targetEntityType,
        bridgeId: bridge.id,
        depth: targetDepth,
        isCyclic,
      });

      if (!isCyclic) {
        visited.add(bridge.targetEntityType);
        queue.push({ entityType: bridge.targetEntityType, depth: targetDepth });
      }
    }
  }

  return { sourceEntityType, edges };
}
