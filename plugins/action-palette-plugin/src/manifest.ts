import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  displayName: "Action Palette",
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
});
