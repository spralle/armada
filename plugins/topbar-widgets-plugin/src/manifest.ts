import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  displayName: "Topbar Widgets",
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
      {
        id: "workspace-indicator",
        slot: "top",
        position: "start",
        order: 0,
        component: "workspace-indicator",
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
});
