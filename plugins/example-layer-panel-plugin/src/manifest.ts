import { definePlugin } from "@ghost-shell/contracts";

export const pluginManifest = definePlugin({
  "displayName": "Example: Panel Layer",
  "contributes": {
    "layerSurfaces": [
      {
        "id": "example-panel",
        "component": "PanelSurface",
        "layer": "bottom",
        "anchor": 7,
        "size": {
          "width": 280
        },
        "exclusiveZone": 280,
        "inputBehavior": "opaque",
        "keyboardInteractivity": "on_demand"
      }
    ]
  }
});
