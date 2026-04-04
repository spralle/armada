import type { PluginContract } from "@armada/plugin-contracts";

export type LocalPluginContractLoader = () => Promise<PluginContract>;

const LOCAL_PLUGIN_LOADERS: Readonly<Record<string, LocalPluginContractLoader>> = {
  "com.armada.plugin-starter": async () => ({
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
  }),
  "com.armada.sample.contract-consumer": async () => ({
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
  }),
};

export function resolveLocalPluginContractLoader(
  pluginId: string,
): LocalPluginContractLoader | null {
  return LOCAL_PLUGIN_LOADERS[pluginId] ?? null;
}
