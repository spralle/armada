import type { PluginContract } from "@ghost-shell/contracts";
import { createActionCatalogFromRegistrySnapshot } from "@ghost-shell/intents";

type CatalogPlugin = {
  id: string;
  enabled: boolean;
  loadStrategy: string;
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
      intent: string;
      when?: Record<string, unknown>;
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
