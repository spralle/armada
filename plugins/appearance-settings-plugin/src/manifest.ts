import { definePlugin } from "@ghost-shell/contracts";

export const pluginManifest = definePlugin({
  "displayName": "Appearance Settings",
  "contributes": {
    "parts": [
      {
        "id": "ghost.shell.appearance",
        "title": "Appearance"
      }
    ]
  },
  "dependsOn": {
    "services": [
      {
        "id": "ghost.theme.Service",
        "versionRange": "^1.0.0"
      },
      {
        "id": "ghost.pluginRegistry.Service",
        "versionRange": "^1.0.0",
        "optional": true
      }
    ]
  }
});
