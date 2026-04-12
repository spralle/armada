import type { PluginContract } from "@ghost/plugin-contracts";

const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.action-palette",
    name: "Action Palette",
    version: "1.0.0",
  },
  contributes: {
    actions: [
      {
        id: "shell.palette.toggle",
        title: "Action Palette: Toggle",
        intent: "shell.palette.toggle",
      },
    ],
    keybindings: [
      {
        action: "shell.palette.toggle",
        keybinding: "ctrl+shift+p",
      },
    ],
  },
};

export { pluginContract };
