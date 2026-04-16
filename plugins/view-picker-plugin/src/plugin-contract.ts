import type { PluginContract } from "@ghost/plugin-contracts";

const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.view-picker",
    name: "View Picker",
    version: "1.0.0",
  },
  contributes: {
    actions: [
      {
        id: "shell.view.open",
        title: "View Picker: Open View",
        intent: "shell.view.open",
      },
    ],
    keybindings: [
      {
        action: "shell.view.open",
        keybinding: "ctrl+alt+o",
      },
    ],
  },
};

export { pluginContract };
