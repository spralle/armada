import "./styles/tailwind.css";
import { defineReactParts } from "@ghost-shell/react";
import { pluginContract } from "./plugin-contract-expose.js";
import { PluginsPanel } from "./components/PluginsPanel.js";

export const parts = defineReactParts(pluginContract, {
  "ghost.shell.plugins": PluginsPanel,
});
