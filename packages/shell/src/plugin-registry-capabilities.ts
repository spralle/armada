import {
  pickComponentModuleExport,
  pickServiceModuleExport,
} from "./capability-registry.js";
import { readCapabilityComponents, readCapabilityServices } from "./plugin-registry-contract.js";
import { pushDiagnostic } from "./plugin-registry-diagnostics.js";
import type {
  PluginRegistryDiagnostic,
  PluginRuntimeState,
} from "./plugin-registry-types.js";
import type { CapabilityRegistry } from "./capability-registry.js";
import type { createRuntimeFirstPluginLoader } from "./plugin-loader.js";

type RuntimeFirstPluginLoader = ReturnType<typeof createRuntimeFirstPluginLoader>;

export async function resolveComponentCapabilityFromStates(
  requesterPluginId: string,
  capabilityId: string,
  states: Map<string, PluginRuntimeState>,
  capabilityRegistry: CapabilityRegistry,
  diagnostics: PluginRegistryDiagnostic[],
  pluginLoader: RuntimeFirstPluginLoader,
): Promise<unknown> {
  const provider = capabilityRegistry.resolveComponent(capabilityId, {
    requesterPluginId,
  });
  if (!provider) {
    pushDiagnostic(diagnostics, {
      at: new Date().toISOString(),
      pluginId: requesterPluginId,
      level: "warn",
      code: "COMPONENT_CAPABILITY_UNRESOLVED",
      message:
        `Plugin '${requesterPluginId}' requested component capability '${capabilityId}', `
        + "but no explicitly enabled provider is active.",
    });
    return null;
  }

  const providerState = states.get(provider.providerPluginId);
  if (!providerState) {
    return null;
  }

  const providerContract = providerState.contract;
  const providerComponents = readCapabilityComponents(providerContract);
  const capability = providerComponents.find((component) => component.id === capabilityId);
  if (!capability) {
    pushDiagnostic(diagnostics, {
      at: new Date().toISOString(),
      pluginId: requesterPluginId,
      level: "warn",
      code: "COMPONENT_CAPABILITY_UNRESOLVED",
      message:
        `Plugin '${requesterPluginId}' requested component capability '${capabilityId}', `
        + `but provider '${provider.providerPluginId}' no longer declares it in contract.`,
    });
    return null;
  }

  if (!providerState.componentsModule) {
    providerState.componentsModule = await pluginLoader.loadPluginComponents(providerState.descriptor);
  }

  const resolved = pickComponentModuleExport(providerState.componentsModule, capability);
  if (resolved === null || resolved === undefined) {
    pushDiagnostic(diagnostics, {
      at: new Date().toISOString(),
      pluginId: requesterPluginId,
      level: "warn",
      code: "COMPONENT_EXPORT_MISSING",
      message:
        `Provider '${provider.providerPluginId}' does not export component capability '${capabilityId}' `
        + "from './pluginComponents'.",
    });
    return null;
  }

  return resolved;
}

export async function resolveServiceCapabilityFromStates(
  requesterPluginId: string,
  capabilityId: string,
  states: Map<string, PluginRuntimeState>,
  capabilityRegistry: CapabilityRegistry,
  diagnostics: PluginRegistryDiagnostic[],
  pluginLoader: RuntimeFirstPluginLoader,
): Promise<unknown> {
  const provider = capabilityRegistry.resolveService(capabilityId, {
    requesterPluginId,
  });
  if (!provider) {
    pushDiagnostic(diagnostics, {
      at: new Date().toISOString(),
      pluginId: requesterPluginId,
      level: "warn",
      code: "SERVICE_CAPABILITY_UNRESOLVED",
      message:
        `Plugin '${requesterPluginId}' requested service capability '${capabilityId}', `
        + "but no explicitly enabled provider is active.",
    });
    return null;
  }

  const providerState = states.get(provider.providerPluginId);
  if (!providerState) {
    return null;
  }

  const providerContract = providerState.contract;
  const providerServices = readCapabilityServices(providerContract);
  const capability = providerServices.find((service) => service.id === capabilityId);
  if (!capability) {
    pushDiagnostic(diagnostics, {
      at: new Date().toISOString(),
      pluginId: requesterPluginId,
      level: "warn",
      code: "SERVICE_CAPABILITY_UNRESOLVED",
      message:
        `Plugin '${requesterPluginId}' requested service capability '${capabilityId}', `
        + `but provider '${provider.providerPluginId}' no longer declares it in contract.`,
    });
    return null;
  }

  // Short-circuit for builtin plugins with pre-registered instances
  if (providerState.builtinServiceInstances?.has(capabilityId)) {
    return providerState.builtinServiceInstances.get(capabilityId) ?? null;
  }

  if (!providerState.servicesModule) {
    providerState.servicesModule = await pluginLoader.loadPluginServices(providerState.descriptor);
  }

  const resolved = pickServiceModuleExport(providerState.servicesModule, capability);
  if (resolved === null || resolved === undefined) {
    pushDiagnostic(diagnostics, {
      at: new Date().toISOString(),
      pluginId: requesterPluginId,
      level: "warn",
      code: "SERVICE_EXPORT_MISSING",
      message:
        `Provider '${provider.providerPluginId}' does not export service capability '${capabilityId}' `
        + "from './pluginServices'.",
    });
    return null;
  }

  return resolved;
}
