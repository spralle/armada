import type { PluginContract } from "@armada/plugin-contracts";

const pluginContract: PluginContract = {
  manifest: {
    id: "com.armada.plugin-starter",
    name: "Plugin Starter",
    version: "0.1.0",
  },
  contributes: {
    parts: [
      {
        id: "starter.part",
        title: "Starter View",
        slot: "main",
        component: "StarterView",
      },
    ],
  },
};

export default pluginContract;
