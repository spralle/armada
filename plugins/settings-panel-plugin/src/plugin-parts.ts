import { defineReactParts } from "@ghost-shell/react";
import { pluginContract } from "./plugin-contract-expose.js";
import { PluginSettingsEditor } from "./components/plugin-settings-editor.js";
import { ConfigTreeInspector } from "./components/config-tree-inspector.js";

export const parts = defineReactParts(pluginContract, {
  "ghost.shell.settings": PluginSettingsEditor,
  "ghost.shell.settings.diagnostics": ConfigTreeInspector,
});
