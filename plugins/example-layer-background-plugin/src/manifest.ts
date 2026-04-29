import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  displayName: "Example: Background Layer",
  contributes: {
    layerSurfaces: [
      {
        id: "example-background",
        component: "BackgroundSurface",
        layer: "background",
        anchor: 15,
        exclusiveZone: -1,
        inputBehavior: "passthrough",
        keyboardInteractivity: "none",
        opacity: 0.85,
      },
    ],
  },
});
