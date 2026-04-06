import type { PluginContract } from "@armada/plugin-contracts";

const pluginContract = {
  manifest: {
    id: "com.armada.shared.ui-capabilities",
    name: "Shared UI Capabilities",
    version: "0.1.0",
  },
  contributes: {
    capabilities: {
      components: [
        {
          id: "com.armada.component.jsonform.control",
          version: "0.1.0",
        },
        {
          id: "com.armada.component.entity-list.seed",
          version: "0.1.0",
        },
      ],
    },
  },
} as PluginContract;

export default pluginContract;
