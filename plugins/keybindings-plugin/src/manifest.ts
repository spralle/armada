import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  "displayName": "Keybindings",
  "contributes": {
    "parts": [
      {
        "id": "ghost.shell.keybindings",
        "title": "Keybindings"
      }
    ]
  },
  "dependsOn": {
    "services": [
      {
        "id": "ghost.keybinding.Service",
        "versionRange": "^1.0.0"
      }
    ],
    "plugins": [
      {
        "pluginId": "ghost.ui",
        "versionRange": "^1.0.0"
      },
      {
        "pluginId": "ghost.shadcn.theme-bridge",
        "versionRange": "^1.0.0"
      }
    ]
  }
});
