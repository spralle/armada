import { definePlugin } from "@ghost-shell/contracts";

export const pluginManifest = definePlugin({
  "displayName": "Sample Contract Consumer",
  "contributes": {
    "parts": [
      {
        "id": "sample.part",
        "title": "Sample View",
        "dock": {
          "container": "main"
        },
        "component": "SampleView"
      }
    ]
  }
});
