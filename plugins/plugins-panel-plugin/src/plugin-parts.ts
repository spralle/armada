import "./styles/tailwind.css";
import { defineReactParts } from "@ghost-shell/react";
import { PluginsPanel } from "./components/PluginsPanel.js";
import { pluginContract } from "./plugin-contract-expose.js";

export const parts = defineReactParts(pluginContract, {
  "ghost.shell.plugins": PluginsPanel,
});
