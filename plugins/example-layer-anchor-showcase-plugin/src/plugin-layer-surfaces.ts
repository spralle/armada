import type { LayerSurfaceContext } from "@ghost-shell/contracts";

/**
 * Anchor showcase surface — renders a colored label showing the anchor combination.
 *
 * Features demonstrated:
 * - All 16 anchor combinations on the floating layer (z=300)
 * - Each surface displays its anchor name and numeric value
 */

/** Map surface IDs to display labels. */
const labels: Record<string, { text: string; color: string }> = {
  "anchor-showcase-anchor-none":  { text: "None (0)",              color: "#f38ba8" },
  "anchor-showcase-anchor-t":     { text: "Top (1)",               color: "#fab387" },
  "anchor-showcase-anchor-r":     { text: "Right (2)",             color: "#f9e2af" },
  "anchor-showcase-anchor-tr":    { text: "Top|Right (3)",         color: "#a6e3a1" },
  "anchor-showcase-anchor-b":     { text: "Bottom (4)",            color: "#94e2d5" },
  "anchor-showcase-anchor-tb":    { text: "Top|Bottom (5)",        color: "#89dceb" },
  "anchor-showcase-anchor-br":    { text: "Bottom|Right (6)",      color: "#74c7ec" },
  "anchor-showcase-anchor-trb":   { text: "Top|Right|Bottom (7)",  color: "#89b4fa" },
  "anchor-showcase-anchor-l":     { text: "Left (8)",              color: "#b4befe" },
  "anchor-showcase-anchor-tl":    { text: "Top|Left (9)",          color: "#cba6f7" },
  "anchor-showcase-anchor-lr":    { text: "Left|Right (10)",       color: "#f5c2e7" },
  "anchor-showcase-anchor-tlr":   { text: "Top|Left|Right (11)",   color: "#eba0ac" },
  "anchor-showcase-anchor-bl":    { text: "Bottom|Left (12)",      color: "#fab387" },
  "anchor-showcase-anchor-ltb":   { text: "Left|Top|Bottom (13)",  color: "#a6e3a1" },
  "anchor-showcase-anchor-brl":   { text: "Bottom|Right|Left (14)", color: "#94e2d5" },
  "anchor-showcase-anchor-trbl":  { text: "Top|Right|Bottom|Left (15)", color: "#89dceb" },
};

export function mount(
  target: HTMLDivElement,
  context: LayerSurfaceContext,
): (() => void) | void {
  const info = labels[context.surfaceId] ?? { text: context.surfaceId, color: "#cdd6f4" };

  const container = document.createElement("div");
  Object.assign(container.style, {
    width: "100%",
    height: "100%",
    backgroundColor: "var(--ghost-color-surface, #1e1e2e)",
    border: `2px solid ${info.color}`,
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    fontSize: "12px",
    fontWeight: "600",
    color: info.color,
    boxSizing: "border-box",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
  });

  container.textContent = info.text;
  target.appendChild(container);

  return () => {
    target.removeChild(container);
  };
}
