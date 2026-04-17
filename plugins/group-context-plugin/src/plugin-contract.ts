import type { PluginContract } from "@ghost/plugin-contracts";

export const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.group-context",
    name: "Group Context",
    version: "1.0.0",
  },
  contributes: {
    parts: [
      {
        id: "ghost.shell.group-context",
        title: "Group context",
      },
    ],
  },
  dependsOn: {
    services: [
      {
        id: "ghost.context.Service",
        versionRange: "^1.0.0",
      },
      {
        id: "ghost.syncStatus.Service",
        versionRange: "^1.0.0",
      },
    ],
  },
};
