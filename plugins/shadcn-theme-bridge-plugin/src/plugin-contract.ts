import type { PluginContract } from "@ghost-shell/plugin-contracts";

/**
 * Plugin contract for the shadcn theme bridge.
 *
 * This plugin maps Ghost's --ghost-* CSS variables to shadcn's expected
 * CSS variable names. It is the ONLY coupling point between the Ghost
 * theme system and shadcn — disabling this plugin completely decouples them.
 */
export const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.shadcn.theme-bridge",
    name: "shadcn Theme Bridge",
    version: "1.0.0",
  },
  activationEvents: ["onStartup"],
  contributes: {
    capabilities: {
      services: [
        { id: "ghost.shadcn.theme-bridge", version: "1.0.0" },
      ],
    },
  },
};
