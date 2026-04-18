import type { PluginContract } from "@ghost/plugin-contracts";
import { AnchorEdge, InputBehavior, KeyboardInteractivity } from "@ghost/plugin-contracts";

/**
 * Custom layer example — registers a custom "widgets" layer and contributes
 * a clock widget surface to it.
 *
 * Demonstrates: custom layer registration at z-order 150, plugin-contributed
 * layer, cascade removal (disabling this plugin removes both the layer and
 * all surfaces on it).
 */
const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.example-layer-custom",
    name: "Example: Custom Layer",
    version: "0.0.1",
  },
  contributes: {
    layers: [
      {
        name: "widgets",
        zOrder: 150,
        defaultKeyboard: KeyboardInteractivity.OnDemand,
        defaultPointer: InputBehavior.Opaque,
      },
    ],
    layerSurfaces: [
      {
        id: "example-custom-clock",
        component: "ClockWidgetSurface",
        layer: "widgets",
        anchor: AnchorEdge.Bottom | AnchorEdge.Right,
        size: { width: 200, height: 200 },
        inputBehavior: InputBehavior.Opaque,
        keyboardInteractivity: KeyboardInteractivity.OnDemand,
      },
    ],
  },
};

export default pluginContract;
