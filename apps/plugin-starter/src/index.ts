import type { PluginContract } from "@armada/plugin-contracts";

export const pluginStarterContract: PluginContract = {
  manifest: {
    id: "com.armada.plugin-starter",
    name: "Plugin Starter",
    version: "0.1.0",
  },
  contributes: {
    views: [
      {
        id: "starter.view",
        title: "Starter View",
        component: "StarterView",
      },
    ],
    commands: [
      {
        id: "starter.command.open-view",
        title: "Starter: Open View",
        intent: "starter.openView",
      },
    ],
    menus: [
      {
        command: "starter.command.open-view",
        menu: "commandPalette",
      },
    ],
    keybindings: [
      {
        command: "starter.command.open-view",
        key: "ctrl+shift+p",
      },
    ],
  },
};

console.log("[plugin-starter] POC plugin stub ready", pluginStarterContract.manifest.id);
