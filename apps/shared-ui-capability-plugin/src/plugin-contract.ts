import type { PluginContract } from "@ghost/plugin-contracts";

const pluginContract = {
  manifest: {
    id: "ghost.shared.ui-capabilities",
    name: "Shared UI Capabilities",
    version: "0.1.0",
  },
  contributes: {
    capabilities: {
      components: [
        {
          id: "ghost.component.jsonform.control",
          version: "0.1.0",
        },
        {
          id: "ghost.component.entity-list.seed",
          version: "0.1.0",
        },
      ],
    },
  },
} as PluginContract;

export default pluginContract;
