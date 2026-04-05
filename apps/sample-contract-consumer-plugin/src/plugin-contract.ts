import type { PluginContract } from "@armada/plugin-contracts";

const pluginContract: PluginContract = {
  manifest: {
    id: "com.armada.sample.contract-consumer",
    name: "Sample Contract Consumer",
    version: "0.1.0",
  },
  contributes: {
    views: [
      {
        id: "sample.view",
        title: "Sample View",
        component: "SampleView",
      },
    ],
  },
};

export default pluginContract;
