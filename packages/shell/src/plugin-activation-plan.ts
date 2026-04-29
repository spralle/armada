/**
 * Input to the activation planner: a plugin ID and its known
 * plugin-level dependencies (from descriptor or preloaded contract).
 */
export interface ActivationPlanEntry {
  id: string;
  pluginDependencies: string[];
}

export interface ActivationPlanRejection {
  pluginId: string;
  code: "CIRCULAR_DEPENDENCY";
  message: string;
}

/**
 * Ordered activation plan produced by dependency-aware topological sort.
 * Each layer's plugins can activate concurrently — their plugin-level
 * dependencies are guaranteed satisfied by earlier layers.
 */
export interface ActivationPlan {
  layers: string[][];
  rejected: ActivationPlanRejection[];
}

/**
 * Build an activation plan from plugin dependency information.
 *
 * 1. A DAG is built from plugin dependency edges *within the activation set*.
 *    External deps (builtins, already-active plugins) are ignored — the
 *    per-plugin dependency validation in `activateState` handles those.
 * 2. Kahn's algorithm produces topological layers and detects cycles.
 */
export function buildActivationPlan(entries: ActivationPlanEntry[]): ActivationPlan {
  const rejected: ActivationPlanRejection[] = [];

  const pluginIds = new Set(entries.map((e) => e.id));

  // Build adjacency: only edges where BOTH ends are in the activation set.
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const entry of entries) {
    inDegree.set(entry.id, 0);
  }

  for (const entry of entries) {
    let count = 0;
    for (const depId of entry.pluginDependencies) {
      if (depId === entry.id) continue;
      if (!pluginIds.has(depId)) continue;
      count++;
      if (!dependents.has(depId)) {
        dependents.set(depId, []);
      }
      dependents.get(depId)?.push(entry.id);
    }
    inDegree.set(entry.id, count);
  }

  // Kahn's algorithm: peel layers of zero-in-degree nodes.
  const layers: string[][] = [];
  let frontier = entries.map((e) => e.id).filter((id) => inDegree.get(id) === 0);

  while (frontier.length > 0) {
    layers.push(frontier);
    const next: string[] = [];

    for (const id of frontier) {
      for (const dep of dependents.get(id) ?? []) {
        const updated = (inDegree.get(dep) ?? 1) - 1;
        inDegree.set(dep, updated);
        if (updated === 0) {
          next.push(dep);
        }
      }
    }

    frontier = next;
  }

  // Remaining nodes with inDegree > 0 are in cycles.
  for (const [id, degree] of inDegree) {
    if (degree > 0) {
      rejected.push({
        pluginId: id,
        code: "CIRCULAR_DEPENDENCY",
        message: `Plugin '${id}' is part of a circular dependency chain.`,
      });
    }
  }

  return { layers, rejected };
}
