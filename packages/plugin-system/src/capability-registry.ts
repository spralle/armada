import type { PluginContract } from "@ghost-shell/contracts/plugin";
import {
  type CapabilityDependencyFailure,
  isProviderUsable,
  type PluginDependencyValidationContext,
  readContractShape,
  validateDependenciesAgainstProviders,
} from "./capability-validation.js";

export type { PluginComponentsModule, PluginServicesModule } from "./capability-module-exports.js";
export { pickComponentModuleExport, pickServiceModuleExport } from "./capability-module-exports.js";
export type {
  CapabilityDependencyFailure,
  CapabilityDependencyFailureCode,
  PluginDependencyValidationContext,
} from "./capability-validation.js";

interface ComponentProvider {
  pluginId: string;
  version: string;
}

interface ServiceProvider {
  pluginId: string;
  version: string;
}

interface CapabilityRegistryProviderSnapshot {
  pluginId: string;
  enabled: boolean;
  contract: PluginContract | null;
}

export interface CapabilityResolutionContext {
  requesterPluginId: string;
}

export interface CapabilityRegistry {
  registerPlugin(pluginId: string, contract: PluginContract): void;
  unregisterPlugin(pluginId: string): void;
  clear(): void;
  validateDependencies(context: PluginDependencyValidationContext): CapabilityDependencyFailure[];
  resolveComponent(capabilityId: string, context: CapabilityResolutionContext): { providerPluginId: string } | null;
  resolveService(capabilityId: string, context: CapabilityResolutionContext): { providerPluginId: string } | null;
}

export function createCapabilityRegistry(
  listProviders: () => CapabilityRegistryProviderSnapshot[],
): CapabilityRegistry {
  const components = new Map<string, ComponentProvider>();
  const services = new Map<string, ServiceProvider>();

  return {
    registerPlugin(pluginId, contract) {
      removeProvidersFromPlugin(pluginId, components, services);
      const shape = readContractShape(contract);
      const contributedComponents = shape.contributes?.capabilities?.components ?? [];
      const contributedServices = shape.contributes?.capabilities?.services ?? [];

      for (const capability of contributedComponents) {
        components.set(capability.id, {
          pluginId,
          version: capability.version,
        });
      }

      for (const capability of contributedServices) {
        services.set(capability.id, {
          pluginId,
          version: capability.version,
        });
      }
    },
    unregisterPlugin(pluginId) {
      removeProvidersFromPlugin(pluginId, components, services);
    },
    clear() {
      components.clear();
      services.clear();
    },
    validateDependencies(context) {
      return validateDependenciesAgainstProviders(context, listProviders(), components, services);
    },
    resolveComponent(capabilityId, context) {
      const provider = components.get(capabilityId);
      if (!provider) {
        return null;
      }

      if (!isProviderUsable(listProviders(), provider.pluginId, context.requesterPluginId)) {
        return null;
      }

      return {
        providerPluginId: provider.pluginId,
      };
    },
    resolveService(capabilityId, context) {
      const provider = services.get(capabilityId);
      if (!provider) {
        return null;
      }

      if (!isProviderUsable(listProviders(), provider.pluginId, context.requesterPluginId)) {
        return null;
      }

      return {
        providerPluginId: provider.pluginId,
      };
    },
  };
}

function removeProvidersFromPlugin(
  pluginId: string,
  components: Map<string, ComponentProvider>,
  services: Map<string, ServiceProvider>,
): void {
  for (const [capabilityId, provider] of components.entries()) {
    if (provider.pluginId === pluginId) {
      components.delete(capabilityId);
    }
  }

  for (const [capabilityId, provider] of services.entries()) {
    if (provider.pluginId === pluginId) {
      services.delete(capabilityId);
    }
  }
}
