import type { PluginContract } from "@ghost/plugin-contracts";
import { AnchorEdge, InputBehavior, KeyboardInteractivity } from "@ghost/plugin-contracts";

/**
 * Modal layer example — centered dialog with focus grab and backdrop.
 *
 * Demonstrates: modal layer, no-anchor (centered), focus grab with backdrop,
 * exclusive keyboard, dismissOnOutsideClick.
 */
const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.example-layer-modal",
    name: "Example: Modal Layer",
    version: "0.0.1",
  },
  contributes: {
    layerSurfaces: [
      {
        id: "example-modal",
        component: "ModalSurface",
        layer: "modal",
        anchor: AnchorEdge.None,
        size: { width: 480, height: 320 },
        inputBehavior: InputBehavior.Opaque,
        keyboardInteractivity: KeyboardInteractivity.Exclusive,
        focusGrab: {
          backdrop: "rgba(0,0,0,0.5)",
          dismissOnOutsideClick: true,
        },
      },
    ],
  },
};

export default pluginContract;
