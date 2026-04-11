import type { PluginContract } from "@ghost/plugin-contracts";

const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.sample.contract-consumer",
    name: "Sample Contract Consumer",
    version: "0.1.0",
  },
  contributes: {
    parts: [
      {
        id: "sample.part",
        title: "Sample View",
        dock: {
          container: "main",
        },
        component: "SampleView",
      },
    ],
  },
};

export default pluginContract;
