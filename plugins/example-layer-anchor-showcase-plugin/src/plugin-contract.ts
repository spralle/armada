import type { PluginContract } from "@ghost/plugin-contracts";
import { AnchorEdge, InputBehavior, KeyboardInteractivity } from "@ghost/plugin-contracts";

/**
 * Anchor showcase — demonstrates all 16 anchor combinations.
 *
 * Each surface is a small labeled tile placed on the floating layer,
 * showing its anchor combination name and numeric value.
 */

/** All 16 anchor combinations with human-readable labels. */
const anchors: Array<{ id: string; label: string; anchor: number; size: { width: number; height: number } }> = [
  { id: "anchor-none",   label: "None (0) — centered",          anchor: 0,                                                              size: { width: 180, height: 40 } },
  { id: "anchor-t",      label: "Top (1)",                       anchor: AnchorEdge.Top,                                                 size: { width: 160, height: 40 } },
  { id: "anchor-r",      label: "Right (2)",                     anchor: AnchorEdge.Right,                                               size: { width: 160, height: 40 } },
  { id: "anchor-tr",     label: "Top|Right (3)",                 anchor: AnchorEdge.Top | AnchorEdge.Right,                              size: { width: 160, height: 40 } },
  { id: "anchor-b",      label: "Bottom (4)",                    anchor: AnchorEdge.Bottom,                                              size: { width: 160, height: 40 } },
  { id: "anchor-tb",     label: "Top|Bottom (5)",                anchor: AnchorEdge.Top | AnchorEdge.Bottom,                             size: { width: 160, height: 40 } },
  { id: "anchor-br",     label: "Bottom|Right (6)",              anchor: AnchorEdge.Bottom | AnchorEdge.Right,                           size: { width: 160, height: 40 } },
  { id: "anchor-trb",    label: "Top|Right|Bottom (7)",          anchor: AnchorEdge.Top | AnchorEdge.Right | AnchorEdge.Bottom,          size: { width: 160, height: 40 } },
  { id: "anchor-l",      label: "Left (8)",                      anchor: AnchorEdge.Left,                                                size: { width: 160, height: 40 } },
  { id: "anchor-tl",     label: "Top|Left (9)",                  anchor: AnchorEdge.Top | AnchorEdge.Left,                               size: { width: 160, height: 40 } },
  { id: "anchor-lr",     label: "Left|Right (10)",               anchor: AnchorEdge.Left | AnchorEdge.Right,                             size: { width: 160, height: 40 } },
  { id: "anchor-tlr",    label: "Top|Left|Right (11)",           anchor: AnchorEdge.Top | AnchorEdge.Left | AnchorEdge.Right,            size: { width: 160, height: 40 } },
  { id: "anchor-bl",     label: "Bottom|Left (12)",              anchor: AnchorEdge.Bottom | AnchorEdge.Left,                            size: { width: 160, height: 40 } },
  { id: "anchor-ltb",    label: "Left|Top|Bottom (13)",          anchor: AnchorEdge.Left | AnchorEdge.Top | AnchorEdge.Bottom,           size: { width: 160, height: 40 } },
  { id: "anchor-brl",    label: "Bottom|Right|Left (14)",        anchor: AnchorEdge.Bottom | AnchorEdge.Right | AnchorEdge.Left,         size: { width: 160, height: 40 } },
  { id: "anchor-trbl",   label: "Top|Right|Bottom|Left (15)",    anchor: AnchorEdge.Top | AnchorEdge.Right | AnchorEdge.Bottom | AnchorEdge.Left, size: { width: 160, height: 40 } },
];

const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.example-layer-anchor-showcase",
    name: "Example: Anchor Showcase",
    version: "0.0.1",
  },
  contributes: {
    layerSurfaces: anchors.map((a, i) => ({
      id: `anchor-showcase-${a.id}`,
      component: "AnchorShowcaseSurface",
      layer: "floating",
      anchor: a.anchor,
      size: a.size,
      margin: { top: 4, right: 4, bottom: 4, left: 4 },
      inputBehavior: InputBehavior.Opaque,
      keyboardInteractivity: KeyboardInteractivity.None,
      order: i,
    })),
  },
};

export default pluginContract;
