import type { PluginContract } from "@ghost/plugin-contracts";

/**
 * Plugin contract for the Ghost UI provider.
 *
 * This plugin bundles @ghost/ui and provides it to all other plugins
 * via the Module Federation shared scope. It depends on the shadcn
 * theme bridge to ensure CSS variables are injected before components render.
 */
export const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.ui",
    name: "Ghost UI Components",
    version: "1.0.0",
  },
  activationEvents: ["onStartup"],
  dependsOn: {
    plugins: [
      {
        pluginId: "ghost.shadcn.theme-bridge",
        versionRange: "^1.0.0",
      },
    ],
  },
};
