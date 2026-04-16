import type { PluginContract } from "@ghost/plugin-contracts";

export const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.keybindings",
    name: "Keybindings",
    version: "1.0.0",
  },
  contributes: {
    parts: [
      {
        id: "ghost.shell.keybindings",
        title: "Keybindings",
      },
    ],
  },
  dependsOn: {
    services: [
      {
        id: "ghost.keybinding.Service",
        versionRange: "^1.0.0",
      },
    ],
  },
};
