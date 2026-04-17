import type { PluginContract } from "@ghost/plugin-contracts";

export const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.appearance-settings",
    name: "Appearance Settings",
    version: "1.0.0",
  },
  contributes: {
    parts: [
      {
        id: "ghost.shell.appearance",
        title: "Appearance",
      },
    ],
  },
  dependsOn: {
    services: [
      {
        id: "ghost.theme.Service",
        versionRange: "^1.0.0",
      },
    ],
  },
};
