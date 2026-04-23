import {
  evaluateShellPluginCompatibility,
} from "./compatibility.js";
import type { PluginContract } from "@ghost-shell/contracts/plugin";

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

export interface PluginDependencyValidationContext {
  pluginId: string;
  pluginVersion: string;
  contract: PluginContract;
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

export function readContractShape(contract: PluginContract): PluginContractDependencyShape {
  if (typeof contract !== "object" || contract === null) {
    return {};
  }
  return contract as PluginContractDependencyShape;
}

export function isProviderUsable(
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

export function validateDependenciesAgainstProviders(
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
