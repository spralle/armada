import type { PluginContract } from "@ghost/plugin-contracts";
import { AnchorEdge, InputBehavior, KeyboardInteractivity } from "@ghost/plugin-contracts";

/**
 * Panel layer example — side-anchored panel with exclusive zone.
 *
 * Demonstrates: bottom layer, left-edge anchor (left+top+bottom), exclusive zone
 * reservation pushing the main layer, on-demand keyboard interactivity.
 */
const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.example-layer-panel",
    name: "Example: Panel Layer",
    version: "0.0.1",
  },
  contributes: {
    layerSurfaces: [
      {
        id: "example-panel",
        component: "PanelSurface",
        layer: "bottom",
        anchor: AnchorEdge.Left | AnchorEdge.Top | AnchorEdge.Bottom,
        size: { width: 280 },
        exclusiveZone: 280,
        inputBehavior: InputBehavior.Opaque,
        keyboardInteractivity: KeyboardInteractivity.OnDemand,
      },
    ],
  },
};

export default pluginContract;
