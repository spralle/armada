import {
  evaluateShellPluginCompatibility,
  type PluginContract,
} from "@armada/plugin-contracts";

interface PluginCapabilityComponentContribution {
  id: string;
  version: string;
}

interface PluginCapabilityServiceContribution {
  id: string;
  version: string;
}

interface PluginDependencyPluginRequirement {
  pluginId: string;
  versionRange: string;
}

interface PluginDependencyComponentRequirement {
  id: string;
  versionRange: string;
  optional?: boolean | undefined;
}

interface PluginDependencyServiceRequirement {
  id: string;
  versionRange: string;
  optional?: boolean | undefined;
}

interface PluginContractDependencyShape {
  contributes?: {
    capabilities?: {
      components?: PluginCapabilityComponentContribution[] | undefined;
      services?: PluginCapabilityServiceContribution[] | undefined;
    };
  };
  dependsOn?: {
    plugins?: PluginDependencyPluginRequirement[] | undefined;
    components?: PluginDependencyComponentRequirement[] | undefined;
    services?: PluginDependencyServiceRequirement[] | undefined;
  };
}

export type CapabilityDependencyFailureCode =
  | "MISSING_DEPENDENCY_PLUGIN"
  | "INCOMPATIBLE_DEPENDENCY_PLUGIN"
  | "MISSING_DEPENDENCY_COMPONENT"
  | "INCOMPATIBLE_DEPENDENCY_COMPONENT"
  | "MISSING_DEPENDENCY_SERVICE"
  | "INCOMPATIBLE_DEPENDENCY_SERVICE";

export interface CapabilityDependencyFailure {
  code: CapabilityDependencyFailureCode;
  message: string;
}

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

export interface PluginDependencyValidationContext {
  pluginId: string;
  pluginVersion: string;
  contract: PluginContract;
}

export interface CapabilityResolutionContext {
  requesterPluginId: string;
}

export interface CapabilityRegistry {
  registerPlugin(pluginId: string, contract: PluginContract): void;
  unregisterPlugin(pluginId: string): void;
  clear(): void;
  validateDependencies(context: PluginDependencyValidationContext): CapabilityDependencyFailure[];
  resolveComponent(
    capabilityId: string,
    context: CapabilityResolutionContext,
  ): { providerPluginId: string } | null;
  resolveService(
    capabilityId: string,
    context: CapabilityResolutionContext,
  ): { providerPluginId: string } | null;
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

function validateDependenciesAgainstProviders(
  context: PluginDependencyValidationContext,
  providers: CapabilityRegistryProviderSnapshot[],
  components: Map<string, ComponentProvider>,
  services: Map<string, ServiceProvider>,
): CapabilityDependencyFailure[] {
  const failures: CapabilityDependencyFailure[] = [];
  const dependencies = readContractShape(context.contract).dependsOn;
  if (!dependencies) {
    return failures;
  }

  const providerById = new Map(providers.map((provider) => [provider.pluginId, provider]));

  for (const requiredPlugin of dependencies.plugins ?? []) {
    if (requiredPlugin.pluginId === context.pluginId) {
      const selfCompatible = evaluateShellPluginCompatibility(
        requiredPlugin.versionRange,
        context.pluginVersion,
      );
      if (!selfCompatible.compatible) {
        failures.push({
          code: "INCOMPATIBLE_DEPENDENCY_PLUGIN",
          message:
            `Plugin '${context.pluginId}' requires plugin '${requiredPlugin.pluginId}' version `
            + `'${requiredPlugin.versionRange}', but active version is '${context.pluginVersion}'.`,
        });
      }
      continue;
    }

    const provider = providerById.get(requiredPlugin.pluginId);
    if (!provider || !provider.enabled || !provider.contract) {
      failures.push({
        code: "MISSING_DEPENDENCY_PLUGIN",
        message:
          `Plugin '${context.pluginId}' depends on plugin '${requiredPlugin.pluginId}' `
          + `(${requiredPlugin.versionRange}), but it is not explicitly enabled and active.`,
      });
      continue;
    }

    const compatible = evaluateShellPluginCompatibility(
      requiredPlugin.versionRange,
      provider.contract.manifest.version,
    );
    if (!compatible.compatible) {
      failures.push({
        code: "INCOMPATIBLE_DEPENDENCY_PLUGIN",
        message:
          `Plugin '${context.pluginId}' requires plugin '${requiredPlugin.pluginId}' version `
          + `'${requiredPlugin.versionRange}', but active version is `
          + `'${provider.contract.manifest.version}'.`,
      });
    }
  }

  for (const requiredComponent of dependencies.components ?? []) {
    const selfCapability = readContractShape(context.contract)
      .contributes?.capabilities?.components
      ?.find((component) => component.id === requiredComponent.id);
    if (selfCapability) {
      const selfCompatible = evaluateShellPluginCompatibility(
        requiredComponent.versionRange,
        selfCapability.version,
      );
      if (!selfCompatible.compatible && !requiredComponent.optional) {
        failures.push({
          code: "INCOMPATIBLE_DEPENDENCY_COMPONENT",
          message:
            `Plugin '${context.pluginId}' requires component capability '${requiredComponent.id}' version `
            + `'${requiredComponent.versionRange}', but self-provided version is '${selfCapability.version}'.`,
        });
      }
      continue;
    }

    const provider = components.get(requiredComponent.id);
    if (!provider || !isProviderUsable(providers, provider.pluginId, context.pluginId)) {
      if (!requiredComponent.optional) {
        failures.push({
          code: "MISSING_DEPENDENCY_COMPONENT",
          message:
            `Plugin '${context.pluginId}' depends on component capability '${requiredComponent.id}' `
            + `(${requiredComponent.versionRange}), but no explicitly enabled provider is active.`,
        });
      }
      continue;
    }

    const compatible = evaluateShellPluginCompatibility(requiredComponent.versionRange, provider.version);
    if (!compatible.compatible && !requiredComponent.optional) {
      failures.push({
        code: "INCOMPATIBLE_DEPENDENCY_COMPONENT",
        message:
          `Plugin '${context.pluginId}' requires component capability '${requiredComponent.id}' version `
          + `'${requiredComponent.versionRange}', but provider '${provider.pluginId}' exposes `
          + `'${provider.version}'.`,
      });
    }
  }

  for (const requiredService of dependencies.services ?? []) {
    const selfCapability = readContractShape(context.contract)
      .contributes?.capabilities?.services
      ?.find((service) => service.id === requiredService.id);
    if (selfCapability) {
      const selfCompatible = evaluateShellPluginCompatibility(
        requiredService.versionRange,
        selfCapability.version,
      );
      if (!selfCompatible.compatible && !requiredService.optional) {
        failures.push({
          code: "INCOMPATIBLE_DEPENDENCY_SERVICE",
          message:
            `Plugin '${context.pluginId}' requires service capability '${requiredService.id}' version `
            + `'${requiredService.versionRange}', but self-provided version is '${selfCapability.version}'.`,
        });
      }
      continue;
    }

    const provider = services.get(requiredService.id);
    if (!provider || !isProviderUsable(providers, provider.pluginId, context.pluginId)) {
      if (!requiredService.optional) {
        failures.push({
          code: "MISSING_DEPENDENCY_SERVICE",
          message:
            `Plugin '${context.pluginId}' depends on service capability '${requiredService.id}' `
            + `(${requiredService.versionRange}), but no explicitly enabled provider is active.`,
        });
      }
      continue;
    }

    const compatible = evaluateShellPluginCompatibility(requiredService.versionRange, provider.version);
    if (!compatible.compatible && !requiredService.optional) {
      failures.push({
        code: "INCOMPATIBLE_DEPENDENCY_SERVICE",
        message:
          `Plugin '${context.pluginId}' requires service capability '${requiredService.id}' version `
          + `'${requiredService.versionRange}', but provider '${provider.pluginId}' exposes `
          + `'${provider.version}'.`,
      });
    }
  }

  return failures;
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

function isProviderUsable(
  providers: CapabilityRegistryProviderSnapshot[],
  providerPluginId: string,
  requesterPluginId: string,
): boolean {
  if (providerPluginId === requesterPluginId) {
    return true;
  }

  const provider = providers.find((entry) => entry.pluginId === providerPluginId);
  return Boolean(provider?.enabled && provider.contract);
}

function readContractShape(contract: PluginContract): PluginContractDependencyShape {
  return contract as PluginContractDependencyShape;
}

export type PluginComponentsModule = Record<string, unknown>;
export type PluginServicesModule = Record<string, unknown>;

export function pickComponentModuleExport(
  module: unknown,
  contribution: PluginCapabilityComponentContribution,
): unknown {
  return pickCapabilityModuleExport(module, contribution.id);
}

export function pickServiceModuleExport(
  module: unknown,
  contribution: PluginCapabilityServiceContribution,
): unknown {
  return pickCapabilityModuleExport(module, contribution.id);
}

function pickCapabilityModuleExport(module: unknown, capabilityId: string): unknown {
  if (!module || typeof module !== "object") {
    return null;
  }

  const record = module as Record<string, unknown>;
  if (capabilityId in record) {
    return record[capabilityId];
  }

  if ("default" in record) {
    const fallback = record.default;
    if (fallback && typeof fallback === "object" && capabilityId in (fallback as Record<string, unknown>)) {
      return (fallback as Record<string, unknown>)[capabilityId];
    }
  }

  return null;
}
