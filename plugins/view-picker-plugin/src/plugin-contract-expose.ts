import { createPluginContract } from "@ghost-shell/contracts/plugin";
import pkg from "../package.json" with { type: "json" };

export const pluginContract = createPluginContract(pkg);

export { activate } from "./plugin-activate.js";
