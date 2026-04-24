import { definePlugin } from "@ghost-shell/contracts";

export const pluginManifest = definePlugin({
  "displayName": "Ghost UI Components",
  "activationEvents": [
    "onStartup"
  ],
  "dependsOn": {
    "plugins": [
      {
        "pluginId": "ghost.shadcn.theme-bridge",
        "versionRange": "^1.0.0"
      }
    ]
  }
});
