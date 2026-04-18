import type { PluginContract } from "@ghost/plugin-contracts";
import {
  createCapabilityRegistry,
  pickComponentModuleExport,
  pickServiceModuleExport,
} from "./capability-registry.js";
import {
  createRuntimeFirstPluginLoader,
} from "./plugin-loader.js";
import type { GhostApiFactoryDependencies } from "./plugin-api/ghost-api-factory.js";
import { createActivationController } from "./plugin-registry-activation.js";
import { readCapabilityComponents, readCapabilityServices } from "./plugin-registry-contract.js";
import {
  cloneLifecycle,
  cloneRuntimeFailure,
  mapLoaderDiagnostic,
  pushDiagnostic,
  transitionLifecycle,
} from "./plugin-registry-diagnostics.js";
import type {
  PluginActivationTrigger,
  PluginRegistryDiagnostic,
  PluginRuntimeState,
  ShellPluginRegistry,
  ShellPluginRegistryOptions,
} from "./plugin-registry-types.js";

export type {
  PluginActivationTrigger,
  PluginActivationTriggerType,
  PluginLifecycleSnapshot,
  PluginLifecycleState,
  PluginRegistryDiagnostic,
  PluginRegistrySnapshot,
} from "./plugin-registry-types.js";
export type { ShellPluginRegistry, ShellPluginRegistryOptions } from "./plugin-registry-types.js";

export function createShellPluginRegistry(
  options: ShellPluginRegistryOptions = {},
): ShellPluginRegistry {
  const diagnostics: PluginRegistryDiagnostic[] = [];
  const pluginLoader =
    options.pluginLoader ??
    createRuntimeFirstPluginLoader({
      onDiagnostic(diagnostic) {
        pushDiagnostic(diagnostics, mapLoaderDiagnostic(diagnostic));
      },
    });
  const states = new Map<string, PluginRuntimeState>();
  const capabilityRegistry = createCapabilityRegistry(() =>
    Array.from(states.entries()).map(([pluginId, state]) => ({
      pluginId,
      enabled: state.enabled,
      contract: state.contract,
    })),
  );
  const ensureActivated = createActivationController(
    states,
    diagnostics,
    pluginLoader,
    capabilityRegistry,
    options.apiDeps,
    options.layerRegistry ?? null,
  );
  const listeners = new Set<() => void>();

  function notifyListeners(): void {
    for (const fn of listeners) fn();
  }

  let tenantId = "local";
  const builtinContracts: Array<{ contract: PluginContract; serviceInstances?: Record<string, unknown> }> = [];

  function seedBuiltinState(contract: PluginContract, serviceInstances?: Record<string, unknown>): void {
    const pluginId = contract.manifest.id;
    const instanceMap = serviceInstances ? new Map(Object.entries(serviceInstances)) : null;
    states.set(pluginId, {
      descriptor: {
        id: pluginId,
        version: contract.manifest.version,
        entry: "builtin://shell",
        compatibility: { shell: "^1.0.0", pluginContract: "^1.0.0" },
      },
      enabled: true,
      loadMode: "remote-manifest",
      contract,
      componentsModule: null,
      servicesModule: null,
      failure: null,
      lifecycle: {
        state: "active",
        lastTransitionAt: new Date().toISOString(),
        lastTrigger: null,
      },
      activationPromise: null,
      activate: null,
      activationSubscriptions: [],
      builtinServiceInstances: instanceMap,
    });
  }

  return {
    registerBuiltinPlugin(contract: PluginContract, serviceInstances?: Record<string, unknown>) {
      builtinContracts.push({ contract, serviceInstances });
      seedBuiltinState(contract, serviceInstances);
      capabilityRegistry.registerPlugin(contract.manifest.id, contract);
      notifyListeners();
    },
    registerManifestDescriptors(nextTenantId, descriptors) {
      tenantId = nextTenantId;
      states.clear();
      capabilityRegistry.clear();
      // Re-register builtin plugins after clear
      for (const entry of builtinContracts) {
        seedBuiltinState(entry.contract, entry.serviceInstances);
        capabilityRegistry.registerPlugin(entry.contract.manifest.id, entry.contract);
      }
      for (const descriptor of descriptors) {
        states.set(descriptor.id, {
          descriptor,
          enabled: false,
          loadMode: pluginLoader.loadModeFor(descriptor),
          contract: null,
          componentsModule: null,
          servicesModule: null,
          failure: null,
          lifecycle: {
            state: "disabled",
            lastTransitionAt: new Date().toISOString(),
            lastTrigger: null,
          },
          activationPromise: null,
          activate: null,
          activationSubscriptions: [],
          builtinServiceInstances: null,
        });
      }
      notifyListeners();
    },
    async setEnabled(pluginId, enabled) {
      const state = states.get(pluginId);
      if (!state) {
        throw new Error(`Plugin '${pluginId}' is not in registry`);
      }

      state.enabled = enabled;
      if (!enabled) {
        disposeActivationSubscriptions(state);
        capabilityRegistry.unregisterPlugin(pluginId);
        if (options.layerRegistry) {
          options.layerRegistry.unregisterPluginLayers(pluginId);
          options.layerRegistry.unregisterSurfaces(pluginId);
        }
        resetRuntimeState(state);
        transitionLifecycle(state, "disabled", null);
        notifyListeners();
        return;
      }

      resetRuntimeState(state);
      transitionLifecycle(state, "registered", null);
      notifyListeners();
    },
    async activateByCommand(pluginId, commandId) {
      const result = await ensureActivated(pluginId, { type: "command", id: commandId });
      notifyListeners();
      return result;
    },
    async activateByView(pluginId, viewId) {
      const result = await ensureActivated(pluginId, { type: "view", id: viewId });
      notifyListeners();
      return result;
    },
    async activateByIntent(pluginId, intentId) {
      const result = await ensureActivated(pluginId, { type: "intent", id: intentId });
      notifyListeners();
      return result;
    },
    async activateByEvent(pluginId, eventName) {
      const result = await ensureActivated(pluginId, { type: "event", id: eventName });
      notifyListeners();
      return result;
    },
    async resolveComponentCapability(requesterPluginId, capabilityId) {
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
    },
    async resolveServiceCapability(requesterPluginId, capabilityId) {
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
    },
    getService<T = unknown>(serviceId: string): T | null {
      const provider = capabilityRegistry.resolveService(serviceId, {
        requesterPluginId: "shell",
      });
      if (!provider) return null;

      const state = states.get(provider.providerPluginId);
      if (!state) return null;

      // Check builtin instances first
      if (state.builtinServiceInstances?.has(serviceId)) {
        return (state.builtinServiceInstances.get(serviceId) as T) ?? null;
      }

      // Check already-loaded services module
      if (state.servicesModule && state.contract) {
        const providerServices = readCapabilityServices(state.contract);
        const cap = providerServices.find(s => s.id === serviceId);
        if (cap) {
          return (pickServiceModuleExport(state.servicesModule, cap) as T) ?? null;
        }
      }

      return null;
    },
    hasService(serviceId: string): boolean {
      return this.getService(serviceId) !== null;
    },
    subscribe(callback: () => void) {
      listeners.add(callback);
      return { dispose: () => listeners.delete(callback) };
    },
    getSnapshot() {
      return {
        tenantId,
        diagnostics: [...diagnostics],
        plugins: Array.from(states.entries()).map(([id, state]) => ({
          id,
          enabled: state.enabled,
          loadMode: state.loadMode,
          descriptor: state.descriptor,
          contract: state.contract,
          failure: cloneRuntimeFailure(state.failure),
          lifecycle: cloneLifecycle(state),
        })),
      };
    },
  };
}

function disposeActivationSubscriptions(state: PluginRuntimeState): void {
  for (const sub of state.activationSubscriptions) {
    sub.dispose();
  }
  state.activationSubscriptions = [];
}

function resetRuntimeState(state: PluginRuntimeState): void {
  state.contract = null;
  state.componentsModule = null;
  state.servicesModule = null;
  state.failure = null;
  state.activationPromise = null;
  state.activate = null;
  state.activationSubscriptions = [];
  // NOTE: Do NOT reset builtinServiceInstances — they persist across resets
}
