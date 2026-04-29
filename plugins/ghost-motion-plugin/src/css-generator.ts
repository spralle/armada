import { ANIMATION_TREE } from "./animation-tree.js";
import { resolveEntry } from "./config-resolver.js";
import type { AnimationName, GhostMotionConfig } from "./config-types.js";
import { KEYFRAMES_REGISTRY } from "./keyframes.js";

/** Resolve a curve name to a CSS cubic-bezier() value. */
function resolveCurve(curveName: string, config: GhostMotionConfig): string {
  const curve = config.curves.find((c) => c.name === curveName);
  if (!curve) return "ease";
  const { x1, y1, x2, y2 } = curve.points;
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

/** Check if a CSS selector targets a motion-attributed element. */
function isMotionSelector(selector: string): boolean {
  return selector.includes("[data-motion");
}

/** Check if a node is transition-based (uses transition, not animation). */
function isTransitionNode(node: {
  transitionProps?: readonly string[] | undefined;
  keyframesMap: Readonly<Record<string, string>>;
}): boolean {
  return (
    node.transitionProps !== undefined && node.transitionProps.length > 0 && Object.keys(node.keyframesMap).length === 0
  );
}

/** Build a CSS block for a transition-based animation node. */
function buildTransitionBlock(
  selector: string,
  node: { transitionProps?: readonly string[] | undefined; cssTarget: string },
  durationMs: number,
  easing: string,
): string {
  if (!node.transitionProps || node.transitionProps.length === 0) {
    return "";
  }
  const props = node.transitionProps.join(", ");
  const transitionValue = node.transitionProps.map((p) => `${p} ${durationMs}ms ${easing}`).join(", ");
  let block = `${selector} {\n  transition: ${transitionValue};\n`;
  if (isMotionSelector(node.cssTarget)) {
    block += `  will-change: ${props};\n`;
  }
  block += "}";
  return block;
}

/** Build a CSS block for a keyframe-based animation node. */
function buildKeyframeBlock(
  selector: string,
  node: { cssTarget: string },
  keyframeName: string,
  durationMs: number,
  easing: string,
  resolved: { style: string; styleParam: number },
): string {
  const iterationCount = resolved.style === "loop" ? "infinite" : "1";
  let block = `${selector} {\n`;
  if (resolved.styleParam > 0) {
    block += `  --ghost-anim-param: ${resolved.styleParam};\n`;
  }
  block += `  animation: ${keyframeName} ${durationMs}ms ${easing} ${iterationCount} both;\n`;
  if (isMotionSelector(node.cssTarget)) {
    block += `  will-change: transform, opacity;\n`;
  }
  block += "}";
  return block;
}

/**
 * Generate the full motion CSS string from a GhostMotionConfig.
 * Returns empty string when animations are globally disabled.
 */
export function generateMotionCss(config: GhostMotionConfig): string {
  if (!config.enabled) return "";

  const blocks: string[] = [];
  const referencedKeyframes = new Set<string>();

  for (const [name, node] of Object.entries(ANIMATION_TREE)) {
    const resolved = resolveEntry(name as AnimationName, config);
    if (!resolved.enabled) continue;

    const durationMs = resolved.speed * 100;
    const easing = resolveCurve(resolved.curve, config);
    const selector = `[data-ghost-motion] ${node.cssTarget}`;

    if (isTransitionNode(node)) {
      blocks.push(buildTransitionBlock(selector, node, durationMs, easing));
    } else if (resolved.style && node.keyframesMap[resolved.style]) {
      const keyframeName = node.keyframesMap[resolved.style];
      referencedKeyframes.add(keyframeName);
      blocks.push(buildKeyframeBlock(selector, node, keyframeName, durationMs, easing, resolved));
    }
  }

  // Emit only referenced @keyframes
  const keyframeBlocks: string[] = [];
  for (const kfName of referencedKeyframes) {
    const kf = KEYFRAMES_REGISTRY[kfName];
    if (kf) keyframeBlocks.push(kf);
  }

  const parts: string[] = [];
  if (keyframeBlocks.length > 0) {
    parts.push(keyframeBlocks.join("\n\n"));
  }
  if (blocks.length > 0) {
    parts.push(blocks.join("\n\n"));
  }

  return parts.join("\n\n");
}
