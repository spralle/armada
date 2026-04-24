import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  "displayName": "Example: Modal Layer",
  "contributes": {
    "layerSurfaces": [
      {
        "id": "example-modal",
        "component": "ModalSurface",
        "layer": "modal",
        "anchor": 0,
        "size": {
          "width": 480,
          "height": 320
        },
        "inputBehavior": "opaque",
        "keyboardInteractivity": "exclusive",
        "focusGrab": {
          "backdrop": "rgba(0,0,0,0.5)",
          "dismissOnOutsideClick": true
        }
      }
    ]
  }
});
