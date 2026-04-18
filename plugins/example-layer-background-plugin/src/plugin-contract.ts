import type { PluginContract } from "@ghost/plugin-contracts";
import { AnchorEdge, InputBehavior, KeyboardInteractivity } from "@ghost/plugin-contracts";

/**
 * Background layer example — animated gradient wallpaper.
 *
 * Demonstrates: background layer, all-edge anchor (fill), passthrough input,
 * theme-aware CSS custom properties, opacity control.
 */
const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.example-layer-background",
    name: "Example: Background Layer",
    version: "0.0.1",
  },
  contributes: {
    layerSurfaces: [
      {
        id: "example-background",
        component: "BackgroundSurface",
        layer: "background",
        anchor: AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right,
        exclusiveZone: -1,
        inputBehavior: InputBehavior.Passthrough,
        keyboardInteractivity: KeyboardInteractivity.None,
        opacity: 0.85,
      },
    ],
  },
};

export default pluginContract;
