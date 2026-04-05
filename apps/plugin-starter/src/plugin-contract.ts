import type { PluginContract } from "@armada/plugin-contracts";

const pluginContract: PluginContract = {
  manifest: {
    id: "com.armada.plugin-starter",
    name: "Plugin Starter",
    version: "0.1.0",
  },
  contributes: {
    views: [
      {
        id: "starter.view",
        title: "Starter View",
        component: "StarterView",
      },
    ],
  },
};

export default pluginContract;
