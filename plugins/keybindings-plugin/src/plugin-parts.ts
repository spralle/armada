import "./styles/tailwind.css";
import { defineReactParts } from "@ghost-shell/react";
import { pluginContract } from "./plugin-contract-expose.js";
import { KeybindingsPanel } from "./components/KeybindingsPanel.js";

export const parts = defineReactParts(pluginContract, {
  "ghost.shell.keybindings": KeybindingsPanel,
});
