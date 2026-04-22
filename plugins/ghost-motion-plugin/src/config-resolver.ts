import type { AnimationEntry, AnimationName, GhostMotionConfig } from "./config-types.js";
import { ANIMATION_TREE } from "./animation-tree.js";

/** Fallback when no overrides exist at a given level. */
const GLOBAL_DEFAULT: Required<AnimationEntry> = {
  enabled: true,
  speed: 5,
  curve: "default",
  style: "",
  styleParam: 0,
};

/**
 * Resolve a single animation entry by walking the tree from child to root,
 * then merging overrides root-first so the child's values win.
 */
export function resolveEntry(
  name: AnimationName,
  config: GhostMotionConfig,
): Required<AnimationEntry> {
  // Build override chain from child to root
  const chain: AnimationEntry[] = [];
  let current: string | null = name;
  while (current !== null) {
    const override = config.animations[current as AnimationName];
    if (override !== undefined) {
      chain.push(override);
    }
    const node = ANIMATION_TREE[current];
    current = node ? node.parent : null;
  }

  // Merge root-first (reverse the child-to-root chain)
  const result = { ...GLOBAL_DEFAULT };
  for (let i = chain.length - 1; i >= 0; i--) {
    const entry = chain[i];
    if (entry.enabled !== undefined) result.enabled = entry.enabled;
    if (entry.speed !== undefined) result.speed = entry.speed;
    if (entry.curve !== undefined) result.curve = entry.curve;
    if (entry.style !== undefined) result.style = entry.style;
    if (entry.styleParam !== undefined) result.styleParam = entry.styleParam;
  }

  return result;
}
