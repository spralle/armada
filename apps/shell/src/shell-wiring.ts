/**
 * Shell wiring helpers — factory functions that bind (root, runtime) closures
 * for bridge sync, keyboard shortcuts, workspace switching, plugin activation,
 * and render delegation. Extracted from index.ts to keep both files cohesive.
 */

import {
  buildActionSurface,
} from "./action-surface.js";
import {
  DEFAULT_SHELL_KEYBINDINGS,
  DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
  USER_KEYBINDING_OVERRIDE_PLUGIN_ID,
} from "./shell-runtime/default-shell-keybindings.js";
import {
  getShellBootstrap,
} from "./bootstrap-shell.js";
import type { ShellRuntime } from "./app/types.js";
import type { PluginActivationTriggerType } from "./plugin-registry.js";
import type { WindowBridgeEvent } from "@ghost-shell/bridge";
import {
  summarizeSelectionPriorities as summarizeSelectionPrioritiesImpl,
  toActionContext,
} from "./shell-runtime/action-context.js";
import {
  bindBridgeSync as bindBridgeSyncHandlers,
  announce as announceImpl,
  publishWithDegrade,
} from "./shell-runtime/bridge-sync-handlers.js";
import { createRuntimeEventHandlers } from "./shell-runtime/runtime-event-handlers.js";
import {
  bindKeyboardShortcuts as bindKeyboardHandlers,
  dismissIntentChooser as dismissIntentChooserState,
} from "./shell-runtime/keyboard-handlers.js";
import { createWindowId } from "./app/utils.js";

export function announce(root: HTMLElement, runtime: ShellRuntime, message: string): void {
  announceImpl(root, runtime, message);
}

export function summarizeSelectionPriorities(runtime: ShellRuntime): string {
  return summarizeSelectionPrioritiesImpl(runtime);
}

export function refreshCommandContributions(runtime: ShellRuntime): void {
  const contracts = runtime.registry
    .getSnapshot()
    .plugins
    .filter((plugin) => plugin.enabled && plugin.contract !== null)
    .map((plugin) => plugin.contract)
    .filter((plugin): plugin is NonNullable<typeof plugin> => plugin !== null);

  runtime.actionSurface = buildActionSurface(contracts);
}

export function renderParts(root: HTMLElement, runtime: ShellRuntime): void {
  getShellBootstrap(runtime).renderParts(root, runtime);
}

export function renderSyncStatus(root: HTMLElement, runtime: ShellRuntime): void {
  getShellBootstrap(runtime).renderSyncStatus(root, runtime);
}

export function renderContextControlsPanel(root: HTMLElement, runtime: ShellRuntime): void {
  getShellBootstrap(runtime).renderContextControlsPanel(root, runtime);
}

export function dismissIntentChooser(root: HTMLElement, runtime: ShellRuntime): void {
  dismissIntentChooserState(runtime, {
    announce: (message) => announce(root, runtime, message),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
  });
}

export function createBridgeBindings(root: HTMLElement, runtime: ShellRuntime) {
  const handlers = createRuntimeEventHandlers(root, runtime, createRuntimeEventHandlerBindings(root, runtime));
  return {
    announce: (message: string) => announce(root, runtime, message),
    applyContext: handlers.applyContext,
    applySelection: handlers.applySelection,
    createWindowId,
    renderContextControlsPanel: () => renderContextControlsPanel(root, runtime),
    renderParts: () => renderParts(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
    summarizeSelectionPriorities: () => summarizeSelectionPriorities(runtime),
  };
}

export function createRuntimeEventHandlerBindings(root: HTMLElement, runtime: ShellRuntime) {
  return {
    activatePluginForBoundary: (options: {
      pluginId: string;
      triggerType: PluginActivationTriggerType;
      triggerId: string;
    }) => activatePluginForBoundary(root, runtime, options),
    announce: (message: string) => announce(root, runtime, message),
    renderContextControlsPanel: () => renderContextControlsPanel(root, runtime),
    renderParts: () => renderParts(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
    summarizeSelectionPriorities: () => summarizeSelectionPriorities(runtime),
  };
}

export function bindBridgeSync(
  root: HTMLElement,
  runtime: ShellRuntime,
  core: Pick<ReturnType<typeof createRuntimeEventHandlers>, "applyContext" | "applySelection">,
): () => void {
  return bindBridgeSyncHandlers(root, runtime, {
    ...createBridgeBindings(root, runtime),
    applyContext: core.applyContext,
    applySelection: core.applySelection,
  });
}

export function bindKeyboardShortcuts(root: HTMLElement, runtime: ShellRuntime): () => void {
  const handlers = createRuntimeEventHandlers(root, runtime, createRuntimeEventHandlerBindings(root, runtime));
  return bindKeyboardHandlers(root, runtime, {
    activatePluginForBoundary: (options) => activatePluginForBoundary(root, runtime, options),
    applySelection: handlers.applySelection,
    announce: (message) => announce(root, runtime, message),
    dismissIntentChooser: () => dismissIntentChooser(root, runtime),
    executeResolvedAction: handlers.executeResolvedAction,
    publishWithDegrade: (event) => {
      publishWithDegrade(root, runtime, event, createBridgeBindings(root, runtime));
    },
    renderContextControls: () => renderContextControlsPanel(root, runtime),
    renderEdgeSlots: () => getShellBootstrap(runtime).renderEdgeSlots(root, runtime),
    renderParts: () => renderParts(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
    toActionContext: () => toActionContext(runtime),
    getDefaultKeybindings: () => DEFAULT_SHELL_KEYBINDINGS.map((entry) => ({
      action: entry.action,
      keybinding: entry.keybinding,
      pluginId: DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
    })),
    getUserOverrideKeybindings: () => runtime.keybindingPersistence.load().map((entry) => ({
      action: entry.action,
      keybinding: entry.keybinding,
      pluginId: USER_KEYBINDING_OVERRIDE_PLUGIN_ID,
    })),
    getWorkspaceSwitchDeps: () => createWorkspaceSwitchDeps(root, runtime, handlers.applySelection),
  });
}

export function createWorkspaceSwitchDeps(
  root: HTMLElement,
  runtime: ShellRuntime,
  applySelectionOverride?: ReturnType<typeof createRuntimeEventHandlers>["applySelection"],
) {
  const bridgeBindings = createBridgeBindings(root, runtime);
  return {
    root,
    runtime,
    partsDeps: {
      applySelection: applySelectionOverride ?? bridgeBindings.applySelection,
      partHost: runtime.partHost,
      publishWithDegrade: (event: WindowBridgeEvent) => {
        publishWithDegrade(root, runtime, event, createBridgeBindings(root, runtime));
      },
      renderContextControls: () => renderContextControlsPanel(root, runtime),
      renderParts: () => renderParts(root, runtime),
      renderSyncStatus: () => renderSyncStatus(root, runtime),
    },
  };
}

export async function primeEnabledPluginActivations(root: HTMLElement, runtime: ShellRuntime): Promise<void> {
  const snapshot = runtime.registry.getSnapshot();
  const activations = snapshot.plugins
    .filter((plugin) =>
      plugin.enabled
      && plugin.lifecycle.state !== "active"
      && plugin.lifecycle.state !== "activating"
      && plugin.lifecycle.state !== "failed"
    )
    .map((plugin) =>
      activatePluginForBoundary(root, runtime, {
        pluginId: plugin.id,
        triggerType: "view",
        triggerId: "shell.render",
      })
    );

  if (activations.length === 0) {
    return;
  }

  await Promise.all(activations);
  refreshCommandContributions(runtime);
  getShellBootstrap(runtime).renderPanels(root, runtime);
  renderParts(root, runtime);
}

export async function activatePluginForBoundary(
  root: HTMLElement,
  runtime: ShellRuntime,
  options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  },
): Promise<boolean> {
  try {
    const activated =
      options.triggerType === "command"
        ? await runtime.registry.activateByCommand(options.pluginId, options.triggerId)
        : options.triggerType === "intent"
          ? await runtime.registry.activateByIntent(options.pluginId, options.triggerId)
          : await runtime.registry.activateByView(options.pluginId, options.triggerId);

    if (!activated) {
      runtime.notice = `Plugin '${options.pluginId}' is not active for ${options.triggerType}:${options.triggerId}.`;
      renderSyncStatus(root, runtime);
      return false;
    }

    runtime.notice = "";
    refreshCommandContributions(runtime);
    getShellBootstrap(runtime).renderPanels(root, runtime);
    return true;
  } catch (error) {
    runtime.notice = `Plugin activation failed for '${options.pluginId}' (${options.triggerType}:${options.triggerId}).`;
    renderSyncStatus(root, runtime);
    console.error("[shell] plugin activation boundary failed", options, error);
    return false;
  }
}
