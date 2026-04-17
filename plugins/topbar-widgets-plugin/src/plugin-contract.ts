import type { PluginContract } from "@ghost/plugin-contracts";

const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.topbar-widgets",
    name: "Topbar Widgets",
    version: "1.0.0",
  },
  contributes: {
    slots: [
      {
        id: "topbar-title",
        slot: "top",
        position: "center",
        order: 0,
        component: "topbar-title",
      },
      {
        id: "topbar-clock",
        slot: "top",
        position: "end",
        order: 0,
        component: "topbar-clock",
      },
    ],
    actions: [
      {
        id: "shell.topbar.toggle",
        title: "Toggle Topbar",
        intent: "shell.topbar.toggle",
      },
    ],
    keybindings: [
      {
        action: "shell.topbar.toggle",
        keybinding: "ctrl+alt+t",
      },
    ],
  },
};

export { pluginContract };
