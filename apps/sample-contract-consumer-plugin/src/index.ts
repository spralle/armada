import { parsePluginContract, type PluginContract } from "@armada/plugin-contracts";

export const samplePluginContract: PluginContract = {
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

const parseResult = parsePluginContract(samplePluginContract);

if (!parseResult.success) {
  throw new Error("Sample plugin contract failed validation");
}
