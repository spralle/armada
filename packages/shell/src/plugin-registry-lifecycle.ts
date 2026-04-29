import { pushDiagnostic } from "./plugin-registry-diagnostics.js";
import { computeReverseDependencies } from "./plugin-registry-service-registration.js";
import type { PluginRegistryDiagnostic, PluginRuntimeState, ShellPluginRegistry } from "./plugin-registry-types.js";

/** Cascade-disable plugins that depend on the just-disabled plugin. */
export async function cascadeDisableDependents(
  disabledPluginId: string,
  registry: ShellPluginRegistry,
  diagnostics: PluginRegistryDiagnostic[],
): Promise<void> {
  const snapshot = registry.getSnapshot();
  const reverseMap = computeReverseDependencies(snapshot);
  const dependents = reverseMap.get(disabledPluginId) ?? [];

  for (const dep of dependents) {
    const depPlugin = snapshot.plugins.find((p) => p.id === dep.pluginId);
    if (depPlugin?.enabled) {
      pushDiagnostic(diagnostics, {
        at: new Date().toISOString(),
        pluginId: dep.pluginId,
        level: "warn",
        code: "CASCADE_DISABLED",
        message: `Plugin '${dep.pluginId}' cascade-disabled because dependency '${disabledPluginId}' was disabled.`,
      });
      await registry.setEnabled(dep.pluginId, false);
    }
  }
}

/** Call the plugin's deactivate() hook, swallowing errors into diagnostics. */
export async function safeCallDeactivate(
  state: PluginRuntimeState,
  pluginId: string,
  diagnostics: PluginRegistryDiagnostic[],
): Promise<void> {
  if (!state.deactivate) return;
  try {
    await state.deactivate({ pluginId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushDiagnostic(diagnostics, {
      at: new Date().toISOString(),
      pluginId,
      level: "warn",
      code: "DEACTIVATE_FAILED",
      message: `Plugin '${pluginId}' deactivate() failed: ${message}`,
    });
  }
}

/** Dispose all activation subscriptions and null out the GhostApi instance. */
export function disposeActivationSubscriptions(state: PluginRuntimeState): void {
  for (const sub of state.activationSubscriptions) {
    sub.dispose();
  }
  state.activationSubscriptions = [];
  state.ghostApiInstance = null;
}

/** Reset mutable runtime state fields to their initial values. */
export function resetRuntimeState(state: PluginRuntimeState): void {
  state.contract = null;
  state.componentsModule = null;
  state.servicesModule = null;
  state.failure = null;
  state.activationPromise = null;
  state.activate = null;
  state.activationSubscriptions = [];
  state.ghostApiInstance = null;
  state.deactivate = null;
  // NOTE: Do NOT reset builtinServiceInstances — they persist across resets
}
