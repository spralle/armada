import { createPluginContract } from "@ghost-shell/contracts/plugin";
import pkg from "../package.json" with { type: "json" };

export const pluginContract = createPluginContract(pkg);

/** Well-known section target for the appearance settings panel. */
export const APPEARANCE_SECTION_TARGET = "config.appearance";
