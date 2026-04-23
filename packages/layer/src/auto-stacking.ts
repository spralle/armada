import type { PluginLayerSurfaceContribution } from "@ghost-shell/contracts/layer";
import { getAnchorKey } from "./anchor-positioning.js";

export interface StackedSurface {
  surfaceId: string;
  surface: PluginLayerSurfaceContribution;
  element: HTMLElement;
}

/**
 * Compute and apply CSS transforms to stack surfaces at the same anchor point.
 *
 * Surfaces with `autoStack` that share an anchor key are grouped and offset
 * in the configured direction. Uses `transform: translate()` to avoid
 * affecting layout flow.
 */
export function applyAutoStacking(surfaces: StackedSurface[]): void {
  const groups = new Map<string, StackedSurface[]>();

  for (const s of surfaces) {
    if (!s.surface.autoStack) continue;
    const key = getAnchorKey(s.surface.anchor);
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(s);
  }

  for (const [, group] of groups) {
    if (group.length <= 1) {
      if (group.length === 1) group[0].element.style.transform = "";
      continue;
    }

    group.sort((a, b) => (a.surface.order ?? 0) - (b.surface.order ?? 0));

    let offset = 0;
    for (const s of group) {
      const { direction, gap } = s.surface.autoStack!;

      if (direction === "down") {
        s.element.style.transform = offset ? `translateY(${offset}px)` : "";
        offset += getEstimatedHeight(s) + gap;
      } else if (direction === "up") {
        s.element.style.transform = offset ? `translateY(${-offset}px)` : "";
        offset += getEstimatedHeight(s) + gap;
      } else if (direction === "right") {
        s.element.style.transform = offset ? `translateX(${offset}px)` : "";
        offset += getEstimatedWidth(s) + gap;
      } else {
        // left
        s.element.style.transform = offset ? `translateX(${-offset}px)` : "";
        offset += getEstimatedWidth(s) + gap;
      }
    }
  }

  // Clear transforms on surfaces without autoStack
  for (const s of surfaces) {
    if (!s.surface.autoStack) {
      s.element.style.transform = "";
    }
  }
}

function getEstimatedHeight(s: StackedSurface): number {
  const rect = s.element.getBoundingClientRect();
  if (rect.height > 0) return rect.height;
  const h = s.surface.size?.height;
  if (typeof h === "number") return h;
  return 60;
}

function getEstimatedWidth(s: StackedSurface): number {
  const rect = s.element.getBoundingClientRect();
  if (rect.width > 0) return rect.width;
  const w = s.surface.size?.width;
  if (typeof w === "number") return w;
  return 300;
}
