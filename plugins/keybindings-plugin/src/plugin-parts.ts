import "./styles/tailwind.css";
import { defineReactParts } from "@ghost-shell/react";
import { KeybindingsPanel } from "./components/KeybindingsPanel.js";
import { pluginContract } from "./plugin-contract-expose.js";

export const parts = defineReactParts(pluginContract, {
  "ghost.shell.keybindings": KeybindingsPanel,
});
