import { AnchorEdge, type PluginLayerSurfaceContribution } from "@ghost-shell/contracts/layer";

/**
 * Format a CSS dimension value: numbers become `px`, strings pass through.
 */
function formatDim(value: number | string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  return typeof value === "number" ? `${value}px` : value;
}

/**
 * Compute CSS positioning styles for a layer surface based on its anchor bitfield,
 * size, and margin.
 *
 * Returns a plain object of CSS property → value pairs (camelCase keys for
 * `Object.assign(el.style, …)` usage).
 */
export function computeAnchorStyles(surface: PluginLayerSurfaceContribution): Record<string, string> {
  const anchor = surface.anchor ?? AnchorEdge.None;
  const m = {
    top: surface.margin?.top ?? 0,
    right: surface.margin?.right ?? 0,
    bottom: surface.margin?.bottom ?? 0,
    left: surface.margin?.left ?? 0,
  };
  const w = formatDim(surface.size?.width, "auto");
  const h = formatDim(surface.size?.height, "auto");

  const hasTop = (anchor & AnchorEdge.Top) !== 0;
  const hasBottom = (anchor & AnchorEdge.Bottom) !== 0;
  const hasLeft = (anchor & AnchorEdge.Left) !== 0;
  const hasRight = (anchor & AnchorEdge.Right) !== 0;

  const base: Record<string, string> = { position: "absolute" };

  // Vertical axis
  if (hasTop && hasBottom) {
    base.top = `${m.top}px`;
    base.bottom = `${m.bottom}px`;
  } else if (hasTop) {
    base.top = `${m.top}px`;
  } else if (hasBottom) {
    base.bottom = `${m.bottom}px`;
  }

  // Horizontal axis
  if (hasLeft && hasRight) {
    base.left = `${m.left}px`;
    base.right = `${m.right}px`;
  } else if (hasLeft) {
    base.left = `${m.left}px`;
  } else if (hasRight) {
    base.right = `${m.right}px`;
  }

  // No anchor at all → centered
  if (anchor === AnchorEdge.None) {
    base.top = "50%";
    base.left = "50%";
    base.transform = "translate(-50%,-50%)";
    base.width = w;
    base.height = h;
    return base;
  }

  // Determine fill vs explicit size per axis
  const verticalAnchored = hasTop || hasBottom;
  const horizontalAnchored = hasLeft || hasRight;

  if (hasTop && hasBottom) {
    // Both vertical edges pinned — no height needed (filled by top+bottom)
    // Horizontal: if neither left nor right → center horizontally with width
    if (!hasLeft && !hasRight) {
      base.left = "50%";
      base.transform = "translateX(-50%)";
      base.width = w;
    }
    // If one or both horizontal edges → already set left/right above
    // If only one horizontal edge, set width
    if (hasLeft !== hasRight) {
      base.width = w;
    }
  } else if (verticalAnchored) {
    // Single vertical edge — need explicit height
    base.height = h;
    // Horizontal: if neither left nor right → fill width via left+right margins
    if (!hasLeft && !hasRight) {
      base.left = `${m.left}px`;
      base.right = `${m.right}px`;
    } else if (hasLeft !== hasRight) {
      // One horizontal edge → corner, need width
      base.width = w;
    }
    // Both horizontal edges → already have left+right set
  }

  if (hasLeft && hasRight) {
    // Both horizontal edges pinned — no width needed
    if (!hasTop && !hasBottom) {
      base.top = "50%";
      base.transform = "translateY(-50%)";
      base.height = h;
    }
    if (hasTop !== hasBottom) {
      base.height = h;
    }
  } else if (horizontalAnchored && !verticalAnchored) {
    // Single horizontal edge only — fill height via top+bottom margins, need width
    base.width = w;
    base.top = `${m.top}px`;
    base.bottom = `${m.bottom}px`;
  }

  // All four edges — no width/height needed
  // (already handled: top+bottom set, left+right set)

  return base;
}

/**
 * Compute exclusive zone insets from all active surfaces.
 *
 * Surfaces with `exclusiveZone > 0` reserve space on the edge determined by
 * their anchor. If multiple surfaces claim the same edge the maximum wins.
 */
export function computeExclusiveZones(surfaces: Array<{ surface: PluginLayerSurfaceContribution; pluginId: string }>): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const result = { top: 0, right: 0, bottom: 0, left: 0 };

  for (const { surface } of surfaces) {
    const ez = surface.exclusiveZone;
    if (ez === undefined || ez <= 0) continue;

    const anchor = surface.anchor ?? AnchorEdge.None;
    const hasTop = (anchor & AnchorEdge.Top) !== 0;
    const hasBottom = (anchor & AnchorEdge.Bottom) !== 0;
    const hasLeft = (anchor & AnchorEdge.Left) !== 0;
    const hasRight = (anchor & AnchorEdge.Right) !== 0;

    // Only unambiguous single-axis anchors reserve space
    if (hasTop && !hasBottom) result.top = Math.max(result.top, ez);
    else if (hasBottom && !hasTop) result.bottom = Math.max(result.bottom, ez);
    else if (hasLeft && !hasRight) result.left = Math.max(result.left, ez);
    else if (hasRight && !hasLeft) result.right = Math.max(result.right, ez);
    // Ambiguous (both opposing edges) → no reservation
  }

  return result;
}

/** Anchor-key labels for each edge flag. */
const EDGE_LABELS: Array<[number, string]> = [
  [AnchorEdge.Top, "top"],
  [AnchorEdge.Bottom, "bottom"],
  [AnchorEdge.Left, "left"],
  [AnchorEdge.Right, "right"],
];

/**
 * Return a stable string key for an anchor bitfield, useful for grouping
 * surfaces by anchor point (auto-stacking).
 *
 * Examples: 0 → "center", 9 (Top+Right) → "top-right", 15 → "top-bottom-left-right".
 */
export function getAnchorKey(anchor: number): string {
  if (anchor === AnchorEdge.None) return "center";
  const parts: string[] = [];
  for (const [flag, label] of EDGE_LABELS) {
    if ((anchor & flag) !== 0) parts.push(label);
  }
  return parts.join("-");
}
