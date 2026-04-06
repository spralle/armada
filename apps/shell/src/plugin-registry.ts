import {
  evaluateShellPluginCompatibility,
  type CompatibilityReasonCode,
  type PluginContract,
  type TenantPluginDescriptor,
} from "@armada/plugin-contracts";
import {
  createCapabilityRegistry,
  pickComponentModuleExport,
  pickServiceModuleExport,
  type CapabilityDependencyFailureCode,
} from "./capability-registry.js";
import {
  createRuntimeFirstPluginLoader,
  type PluginLoadDiagnostic,
  type PluginLoadError,
  type RuntimeFirstPluginLoader,
  type ShellPluginLoadMode,
} from "./plugin-loader.js";

const SHELL_CONTRACT_DECLARATION = "^1.0.0";
const MAX_DIAGNOSTICS = 30;

interface PluginRuntimeFailure {
  code:
    | CompatibilityReasonCode
    | "REMOTE_UNAVAILABLE"
    | "INVALID_CONTRACT"
    | "COMPONENTS_UNAVAILABLE"
    | "SERVICES_UNAVAILABLE"
    | CapabilityDependencyFailureCode
    | "COMPONENT_EXPORT_MISSING"
    | "SERVICE_EXPORT_MISSING"
    | "LOCAL_SOURCE_UNAVAILABLE"
    | "UNKNOWN_PLUGIN_LOAD_ERROR";
  message: string;
  retryable: boolean;
}

export type PluginActivationTriggerType = "command" | "view" | "intent";

export type PluginLifecycleState =
  | "disabled"
  | "registered"
  | "activating"
  | "active"
  | "failed";

export interface PluginActivationTrigger {
  type: PluginActivationTriggerType;
  id: string;
}

export interface PluginLifecycleSnapshot {
  state: PluginLifecycleState;
  lastTransitionAt: string;
  lastTrigger: PluginActivationTrigger | null;
}

interface PluginRuntimeState {
  descriptor: TenantPluginDescriptor;
  enabled: boolean;
  loadMode: ShellPluginLoadMode;
  contract: PluginContract | null;
  componentsModule: unknown | null;
  servicesModule: unknown | null;
  failure: PluginRuntimeFailure | null;
  lifecycle: PluginLifecycleSnapshot;
  activationPromise: Promise<void> | null;
}

export interface PluginRegistryDiagnostic {
  at: string;
  pluginId: string;
  level: "info" | "warn";
  code: string;
  message: string;
}

export interface PluginRegistrySnapshot {
  tenantId: string;
  diagnostics: PluginRegistryDiagnostic[];
  plugins: {
    id: string;
    enabled: boolean;
    loadMode: ShellPluginLoadMode;
    descriptor: TenantPluginDescriptor;
    contract: PluginContract | null;
    failure: PluginRuntimeFailure | null;
    lifecycle: PluginLifecycleSnapshot;
  }[];
}

export interface ShellPluginRegistry {
  registerManifestDescriptors(tenantId: string, descriptors: TenantPluginDescriptor[]): void;
  setEnabled(pluginId: string, enabled: boolean): Promise<void>;
  activateByCommand(pluginId: string, commandId: string): Promise<boolean>;
  activateByView(pluginId: string, viewId: string): Promise<boolean>;
  activateByIntent(pluginId: string, intentId: string): Promise<boolean>;
  resolveComponentCapability(requesterPluginId: string, capabilityId: string): Promise<unknown | null>;
  resolveServiceCapability(requesterPluginId: string, capabilityId: string): Promise<unknown | null>;
  getSnapshot(): PluginRegistrySnapshot;
}

export interface ShellPluginRegistryOptions {
  pluginLoader?: RuntimeFirstPluginLoader;
}

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
  let tenantId = "local";

  return {
    registerManifestDescriptors(nextTenantId, descriptors) {
      tenantId = nextTenantId;
      states.clear();
      capabilityRegistry.clear();
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
        });
      }
    },
    async setEnabled(pluginId, enabled) {
      const state = states.get(pluginId);
      if (!state) {
        throw new Error(`Plugin '${pluginId}' is not in registry`);
      }

      state.enabled = enabled;
      if (!enabled) {
        capabilityRegistry.unregisterPlugin(pluginId);
        state.contract = null;
        state.componentsModule = null;
        state.servicesModule = null;
        state.failure = null;
        state.activationPromise = null;
        transitionLifecycle(state, "disabled", null);
        return;
      }

      state.contract = null;
      state.componentsModule = null;
      state.servicesModule = null;
      state.failure = null;
      transitionLifecycle(state, "registered", null);
    },
    async activateByCommand(pluginId, commandId) {
      return ensureActivated(pluginId, {
        type: "command",
        id: commandId,
      });
    },
    async activateByView(pluginId, viewId) {
      return ensureActivated(pluginId, {
        type: "view",
        id: viewId,
      });
    },
    async activateByIntent(pluginId, intentId) {
      return ensureActivated(pluginId, {
        type: "intent",
        id: intentId,
      });
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
          failure: state.failure,
          lifecycle: {
            ...state.lifecycle,
            lastTrigger: state.lifecycle.lastTrigger
              ? { ...state.lifecycle.lastTrigger }
              : null,
          },
        })),
      };
    },
  };

  async function ensureActivated(
    pluginId: string,
    trigger: PluginActivationTrigger,
  ): Promise<boolean> {
    const state = states.get(pluginId);
    if (!state) {
      pushDiagnostic(diagnostics, {
        at: new Date().toISOString(),
        pluginId,
        level: "warn",
        code: "UNKNOWN_PLUGIN",
        message: `Activation requested for unknown plugin '${pluginId}' via ${trigger.type}:${trigger.id}.`,
      });
      return false;
    }

    if (!state.enabled) {
      pushDiagnostic(diagnostics, {
        at: new Date().toISOString(),
        pluginId,
        level: "info",
        code: "ACTIVATION_SKIPPED_DISABLED",
        message: `Skipped activation for disabled plugin '${pluginId}' via ${trigger.type}:${trigger.id}.`,
      });
      return false;
    }

    if (state.contract && state.lifecycle.state === "active") {
      state.lifecycle.lastTrigger = trigger;
      return true;
    }

    if (state.activationPromise) {
      await state.activationPromise;
      return state.contract !== null && state.lifecycle.state === "active";
    }

    state.activationPromise = activateState(state, pluginId, trigger);
    await state.activationPromise;
    return state.contract !== null && state.lifecycle.state === "active";
  }

  async function activateState(
    state: PluginRuntimeState,
    pluginId: string,
    trigger: PluginActivationTrigger,
  ): Promise<void> {
    state.contract = null;
    state.failure = null;
    transitionLifecycle(state, "activating", trigger);

    const compatibility = evaluateShellPluginCompatibility(
      SHELL_CONTRACT_DECLARATION,
      state.descriptor.compatibility.pluginContract,
    );
    if (!compatibility.compatible) {
      state.failure = {
        code: compatibility.code,
        message: `${compatibility.message} (shell='${SHELL_CONTRACT_DECLARATION}', plugin='${state.descriptor.compatibility.pluginContract}')`,
        retryable: false,
      };
      transitionLifecycle(state, "failed", trigger);
      pushDiagnostic(diagnostics, {
        at: new Date().toISOString(),
        pluginId,
        level: "warn",
        code: compatibility.code,
        message: state.failure.message,
      });
      state.activationPromise = null;
      return;
    }

    try {
      state.contract = await pluginLoader.loadPluginContract(state.descriptor);
      const dependencyFailures = capabilityRegistry.validateDependencies({
        pluginId,
        pluginVersion: state.descriptor.version,
        contract: state.contract,
      });
      if (dependencyFailures.length > 0) {
        const firstFailure = dependencyFailures[0];
        if (firstFailure) {
          state.failure = {
            code: firstFailure.code,
            message: firstFailure.message,
            retryable: false,
          };
          state.contract = null;
          capabilityRegistry.unregisterPlugin(pluginId);
          transitionLifecycle(state, "failed", trigger);
          for (const failure of dependencyFailures) {
            pushDiagnostic(diagnostics, {
              at: new Date().toISOString(),
              pluginId,
              level: "warn",
              code: failure.code,
              message: failure.message,
            });
          }
          state.activationPromise = null;
          return;
        }
      }

      capabilityRegistry.registerPlugin(pluginId, state.contract);
      state.failure = null;
      transitionLifecycle(state, "active", trigger);
    } catch (error) {
      const failure = mapPluginLoadFailure(error);
      capabilityRegistry.unregisterPlugin(pluginId);
      state.contract = null;
      state.componentsModule = null;
      state.servicesModule = null;
      state.failure = failure;
      transitionLifecycle(state, "failed", trigger);
      pushDiagnostic(diagnostics, {
        at: new Date().toISOString(),
        pluginId,
        level: "warn",
        code: failure.code,
        message: failure.message,
      });
    }

    state.activationPromise = null;
  }
}

function transitionLifecycle(
  state: PluginRuntimeState,
  nextState: PluginLifecycleState,
  trigger: PluginActivationTrigger | null,
): void {
  state.lifecycle = {
    state: nextState,
    lastTransitionAt: new Date().toISOString(),
    lastTrigger: trigger,
  };
}

function mapPluginLoadFailure(error: unknown): PluginRuntimeFailure {
  if (isPluginLoadError(error)) {
    return {
      code: error.context.reason,
      message: error.context.message,
      retryable: error.context.reason === "REMOTE_UNAVAILABLE",
    };
  }

  return {
    code: "UNKNOWN_PLUGIN_LOAD_ERROR",
    message: "Plugin failed to load due to an unexpected error.",
    retryable: true,
  };
}

function isPluginLoadError(error: unknown): error is PluginLoadError {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "context" in error;
}

function mapLoaderDiagnostic(diagnostic: PluginLoadDiagnostic): PluginRegistryDiagnostic {
  const moduleLabel = diagnostic.module ? ` (${diagnostic.module})` : "";
  return {
    at: new Date().toISOString(),
    pluginId: diagnostic.pluginId,
    level: diagnostic.level,
    code: diagnostic.code,
    message: `${diagnostic.message}${moduleLabel}`,
  };
}

function readCapabilityComponents(contract: PluginContract | null): Array<{ id: string; version: string }> {
  if (!contract || !("contributes" in contract)) {
    return [];
  }

  const contributes = (contract as { contributes?: { capabilities?: { components?: Array<{ id: string; version: string }> } } })
    .contributes;
  return contributes?.capabilities?.components ?? [];
}

function readCapabilityServices(contract: PluginContract | null): Array<{ id: string; version: string }> {
  if (!contract || !("contributes" in contract)) {
    return [];
  }

  const contributes = (contract as { contributes?: { capabilities?: { services?: Array<{ id: string; version: string }> } } })
    .contributes;
  return contributes?.capabilities?.services ?? [];
}

function pushDiagnostic(
  diagnostics: PluginRegistryDiagnostic[],
  diagnostic: PluginRegistryDiagnostic,
): void {
  diagnostics.unshift(diagnostic);
  if (diagnostics.length > MAX_DIAGNOSTICS) {
    diagnostics.length = MAX_DIAGNOSTICS;
  }
}
