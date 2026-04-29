import "./styles/tailwind.css";
import { defineReactParts } from "@ghost-shell/react";
import { ConfigTreeInspector } from "./components/config-tree-inspector.js";
import { PluginSettingsEditor } from "./components/plugin-settings-editor.js";
import { pluginContract } from "./plugin-contract-expose.js";

export const parts = defineReactParts(pluginContract, {
  "ghost.shell.settings": PluginSettingsEditor,
  "ghost.shell.settings.diagnostics": ConfigTreeInspector,
});
