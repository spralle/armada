import {
  evaluateShellPluginCompatibility,
  type CompatibilityReasonCode,
  type PluginContract,
  type TenantPluginDescriptor,
} from "@armada/plugin-contracts";
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
    | "LOCAL_SOURCE_UNAVAILABLE"
    | "UNKNOWN_PLUGIN_LOAD_ERROR";
  message: string;
  retryable: boolean;
}

interface PluginRuntimeState {
  descriptor: TenantPluginDescriptor;
  enabled: boolean;
  loadMode: ShellPluginLoadMode;
  contract: PluginContract | null;
  failure: PluginRuntimeFailure | null;
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
  }[];
}

export interface ShellPluginRegistry {
  registerManifestDescriptors(tenantId: string, descriptors: TenantPluginDescriptor[]): void;
  setEnabled(pluginId: string, enabled: boolean): Promise<void>;
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
  let tenantId = "local";

  return {
    registerManifestDescriptors(nextTenantId, descriptors) {
      tenantId = nextTenantId;
      states.clear();
      for (const descriptor of descriptors) {
        states.set(descriptor.id, {
          descriptor,
          enabled: false,
          loadMode: pluginLoader.loadModeFor(descriptor),
          contract: null,
          failure: null,
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
        state.contract = null;
        state.failure = null;
        return;
      }

      state.contract = null;
      state.failure = null;

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
        pushDiagnostic(diagnostics, {
          at: new Date().toISOString(),
          pluginId,
          level: "warn",
          code: compatibility.code,
          message: state.failure.message,
        });
        return;
      }

      try {
        state.contract = await pluginLoader.loadPluginContract(state.descriptor);
      } catch (error) {
        const failure = mapPluginLoadFailure(error);
        state.contract = null;
        state.failure = failure;
        pushDiagnostic(diagnostics, {
          at: new Date().toISOString(),
          pluginId,
          level: "warn",
          code: failure.code,
          message: failure.message,
        });
      }
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
        })),
      };
    },
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
  return {
    at: new Date().toISOString(),
    pluginId: diagnostic.pluginId,
    level: diagnostic.level,
    code: diagnostic.code,
    message: diagnostic.message,
  };
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
