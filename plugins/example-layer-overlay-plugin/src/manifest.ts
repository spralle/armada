import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  displayName: "Example: Overlay Layer",
  contributes: {
    layerSurfaces: [
      {
        id: "example-overlay-lock",
        component: "OverlayLockSurface",
        layer: "overlay",
        anchor: 15,
        inputBehavior: "opaque",
        keyboardInteractivity: "exclusive",
        sessionLock: true,
      },
    ],
  },
});
