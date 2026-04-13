import type { PluginContract } from "@ghost-shell/plugin-contracts";

const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.plugin-starter",
    name: "Plugin Starter",
    version: "0.1.0",
  },
  contributes: {
    parts: [
      {
        id: "starter.part",
        title: "Starter View",
        dock: {
          container: "main",
        },
        component: "StarterView",
      },
    ],
  },
};

export default pluginContract;
