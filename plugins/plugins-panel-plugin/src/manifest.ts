import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  displayName: "Plugins Panel",
  contributes: {
    parts: [
      {
        id: "ghost.shell.plugins",
        title: "Plugins",
      },
    ],
  },
  dependsOn: {
    services: [
      {
        id: "ghost.pluginRegistry.Service",
        versionRange: "^1.0.0",
      },
      {
        id: "ghost.pluginManagement.Service",
        versionRange: "^1.0.0",
      },
      {
        id: "ghost.syncStatus.Service",
        versionRange: "^1.0.0",
      },
    ],
    plugins: [
      {
        pluginId: "ghost.ui",
        versionRange: "^1.0.0",
      },
      {
        pluginId: "ghost.shadcn.theme-bridge",
        versionRange: "^1.0.0",
      },
    ],
  },
});
