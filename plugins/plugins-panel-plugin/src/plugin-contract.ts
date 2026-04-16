import type { PluginContract } from "@ghost/plugin-contracts";

export const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.plugins-panel",
    name: "Plugins Panel",
    version: "1.0.0",
  },
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
  },
};
