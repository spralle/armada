import { evaluateShellPluginCompatibility } from "@ghost-shell/plugin-contracts";
import type { CapabilityRegistry } from "./capability-registry.js";
import {
  createActivationContext,
  createGhostApi,
  type GhostApiFactoryDependencies,
} from "./plugin-api/ghost-api-factory.js";
import type { RuntimeFirstPluginLoader, PluginLoadError } from "./plugin-loader.js";
import { pushDiagnostic, transitionLifecycle } from "./plugin-registry-diagnostics.js";
import type {
  PluginActivationTrigger,
  PluginRegistryDiagnostic,
  PluginRuntimeFailure,
  PluginRuntimeState,
  ShellPluginRegistry,
} from "./plugin-registry-types.js";

const SHELL_CONTRACT_DECLARATION = "^1.0.0";

export function createActivationController(
  states: Map<string, PluginRuntimeState>,
  diagnostics: PluginRegistryDiagnostic[],
  pluginLoader: RuntimeFirstPluginLoader,
  capabilityRegistry: CapabilityRegistry,
  apiDeps?: GhostApiFactoryDependencies,
): (pluginId: string, trigger: PluginActivationTrigger) => Promise<boolean> {
  return async (pluginId, trigger) => {
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

    state.activationPromise = activateState(
      state,
      pluginId,
      trigger,
      diagnostics,
      pluginLoader,
      capabilityRegistry,
      apiDeps,
    );
    await state.activationPromise;
    return state.contract !== null && state.lifecycle.state === "active";
  };
}

async function activateState(
  state: PluginRuntimeState,
  pluginId: string,
  trigger: PluginActivationTrigger,
  diagnostics: PluginRegistryDiagnostic[],
  pluginLoader: RuntimeFirstPluginLoader,
  capabilityRegistry: CapabilityRegistry,
  apiDeps?: GhostApiFactoryDependencies,
): Promise<void> {
  state.contract = null;
  state.failure = null;
  state.activate = null;
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
    const loadResult = await pluginLoader.loadPluginContract(state.descriptor);
    state.contract = loadResult.contract;
    state.activate = loadResult.activate;

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
        state.activate = null;
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

    // Call the plugin's activate() lifecycle hook if present
    if (state.activate && apiDeps) {
      const { api } = createGhostApi(apiDeps);
      const ctx = createActivationContext(pluginId);

      try {
        await state.activate(api, ctx);
        state.activationSubscriptions = ctx.subscriptions;
      } catch (activateError) {
        const message = activateError instanceof Error
          ? activateError.message
          : String(activateError);
        state.failure = {
          code: "ACTIVATE_FAILED",
          message: `Plugin '${pluginId}' activate() failed: ${message}`,
          retryable: false,
        };
        state.contract = null;
        state.activate = null;
        capabilityRegistry.unregisterPlugin(pluginId);
        transitionLifecycle(state, "failed", trigger);
        pushDiagnostic(diagnostics, {
          at: new Date().toISOString(),
          pluginId,
          level: "warn",
          code: "ACTIVATE_FAILED",
          message: state.failure.message,
        });
        state.activationPromise = null;
        return;
      }
    }

    state.failure = null;
    transitionLifecycle(state, "active", trigger);
  } catch (error) {
    const failure = mapPluginLoadFailure(error);
    capabilityRegistry.unregisterPlugin(pluginId);
    state.contract = null;
    state.activate = null;
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

// ---------------------------------------------------------------------------
// Startup activation event
// ---------------------------------------------------------------------------

export interface StartupActivationResult {
  activated: string[];
  skipped: string[];
  failed: string[];
}

/**
 * Eagerly activate all enabled plugins that declare `activationEvents`
 * including `"onStartup"`.
 *
 * Because contracts are loaded lazily, this function activates every enabled
 * plugin via the registry, then inspects the loaded contract for the
 * `onStartup` event. Plugins whose contracts do not include `onStartup`
 * are still activated as a side effect — this is intentional during bootstrap
 * to front-load contract loading for theme discovery.
 */
export async function activateByStartupEvent(
  registry: ShellPluginRegistry,
): Promise<StartupActivationResult> {
  const snapshot = registry.getSnapshot();
  const result: StartupActivationResult = {
    activated: [],
    skipped: [],
    failed: [],
  };

  const activationPromises = snapshot.plugins
    .filter((plugin) => plugin.enabled)
    .map(async (plugin) => {
      try {
        const success = await registry.activateByEvent(plugin.id, "onStartup");
        if (success) {
          result.activated.push(plugin.id);
        } else {
          result.failed.push(plugin.id);
        }
      } catch {
        result.failed.push(plugin.id);
      }
    });

  await Promise.all(activationPromises);
  return result;
}
