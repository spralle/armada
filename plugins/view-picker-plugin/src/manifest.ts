import { definePlugin } from "@ghost-shell/contracts";

export const pluginManifest = definePlugin({
  "displayName": "View Picker",
  "contributes": {
    "actions": [
      {
        "id": "shell.view.open",
        "title": "View Picker: Open View",
        "intent": "shell.view.open"
      }
    ],
    "keybindings": [
      {
        "action": "shell.view.open",
        "keybinding": "ctrl+alt+o"
      }
    ]
  }
});
