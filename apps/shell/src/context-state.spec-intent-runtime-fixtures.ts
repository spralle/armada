import type { PluginContract } from "@armada/plugin-contracts";
import { createActionCatalogFromRegistrySnapshot } from "./intent-runtime.js";

type CatalogPlugin = {
  id: string;
  enabled: boolean;
  loadMode: string;
  contract: PluginContract;
};

type RuntimeActionContract = {
  manifest: {
    id: string;
    name: string;
    version: string;
  };
  contributes: {
    actions?: {
      id: string;
      title: string;
      handler: string;
      intentType: string;
      when: Record<string, unknown>;
    }[];
    parts?: {
      id: string;
      title: string;
      dock?: {
        container?: string;
        order?: number;
      };
      component: string;
    }[];
  };
};

export function createCatalog(plugins: CatalogPlugin[]) {
  return createActionCatalogFromRegistrySnapshot({ plugins });
}

export function createContract(contract: RuntimeActionContract): PluginContract {
  return contract as unknown as PluginContract;
}
