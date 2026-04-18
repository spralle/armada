import type { PluginContract } from "@ghost/plugin-contracts";
import { AnchorEdge, InputBehavior, KeyboardInteractivity } from "@ghost/plugin-contracts";

/**
 * Overlay layer example — session lock screen.
 *
 * Demonstrates: overlay layer, all-edge anchor (fill), session lock semantics,
 * exclusive keyboard, dismiss to unlock.
 */
const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.example-layer-overlay",
    name: "Example: Overlay Layer",
    version: "0.0.1",
  },
  contributes: {
    layerSurfaces: [
      {
        id: "example-overlay-lock",
        component: "OverlayLockSurface",
        layer: "overlay",
        anchor: AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right,
        inputBehavior: InputBehavior.Opaque,
        keyboardInteractivity: KeyboardInteractivity.Exclusive,
        sessionLock: true,
      },
    ],
  },
};

export default pluginContract;
