// Theme CSS custom properties (--ghost-*, etc.) are inherited through the DOM tree.
// Background layer surfaces can use these variables for theme-aware rendering.

/**
 * Apply visual effects (opacity, backdrop-filter) to a surface element.
 * Called during surface mount and when effects change dynamically.
 */
export function applyVisualEffects(
  element: HTMLElement,
  opacity?: number,
  backdropFilter?: string,
): void {
  // Set CSS opacity (default 1.0)
  if (opacity !== undefined && opacity !== 1) {
    element.style.opacity = String(opacity);
  } else {
    element.style.opacity = "";
  }

  // Set CSS backdrop-filter (frosted glass)
  if (backdropFilter) {
    element.style.backdropFilter = backdropFilter;
    (element.style as unknown as Record<string, string>).webkitBackdropFilter = backdropFilter; // Safari
  } else {
    element.style.backdropFilter = "";
    (element.style as unknown as Record<string, string>).webkitBackdropFilter = "";
  }
}

/**
 * Set opacity dynamically with smooth CSS transition.
 */
export function setDynamicOpacity(element: HTMLElement, value: number): void {
  element.style.opacity = String(Math.max(0, Math.min(1, value)));
}
