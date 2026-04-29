import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  displayName: "Example: Custom Layer",
  contributes: {
    layers: [
      {
        name: "widgets",
        zOrder: 150,
        defaultKeyboard: "on_demand",
        defaultPointer: "opaque",
      },
    ],
    layerSurfaces: [
      {
        id: "example-custom-clock",
        component: "ClockWidgetSurface",
        layer: "widgets",
        anchor: 10,
        size: {
          width: 200,
          height: 200,
        },
        inputBehavior: "opaque",
        keyboardInteractivity: "on_demand",
      },
    ],
  },
});
