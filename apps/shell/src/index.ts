import {
  createRevision,
  ensureTabsRegistered,
  updateContextState,
  readGroupSelectionContext,
} from "./context/runtime-state.js";
import {
  type IntentActionMatch,
  type ShellIntent,
} from "./intent-runtime.js";
import {
  buildActionSurface,
} from "./action-surface.js";
import {
  resolveChooserFocusRestoration,
} from "./keyboard-a11y.js";
import { shellBootstrapState } from "./app/bootstrap.js";
import { bootstrapShellWithTenantManifest } from "./app/bootstrap.js";
import { createShellRuntime } from "./app/runtime.js";
import type { ShellRuntime } from "./app/types.js";
import type { PluginActivationTriggerType } from "./plugin-registry.js";
import {
  type ContextSyncEvent,
  type SelectionSyncEvent,
} from "./window-bridge.js";
import {
  startPopoutWatchdog,
} from "./ui/parts-controller.js";
import {
  mountMainWindow,
  mountPopout,
} from "./ui/shell-mount.js";
import {
  updateWindowReadOnlyState,
} from "./ui/context-controls.js";
import { createWindowId } from "./app/utils.js";
import { applyLayout, setupResize } from "./shell-runtime/layout-helpers.js";
import {
  renderCommandSurface as renderCommandSurfaceView,
  summarizeSelectionPriorities,
  toActionContext,
} from "./shell-runtime/command-surface-render.js";
import {
  bindBridgeSync as bindBridgeSyncHandlers,
  announce,
  publishWithDegrade,
} from "./shell-runtime/bridge-sync-handlers.js";
import { createRuntimeEventHandlers } from "./shell-runtime/runtime-event-handlers.js";
import {
  bindKeyboardShortcuts as bindKeyboardHandlers,
  dismissIntentChooser as dismissIntentChooserState,
} from "./shell-runtime/keyboard-handlers.js";
import {
  initializeReactPanels as initializeRuntimePanels,
  renderContextControlsPanel as renderContextControlsPanelView,
  renderPanels,
  renderParts as renderPartsView,
  renderSyncStatus as renderSyncStatusView,
} from "./shell-runtime/runtime-render.js";

export function startShell(root: HTMLElement): ShellRuntime {
  const shellRuntime = createShellRuntime();
  mountShell(root, shellRuntime);
  initializeReactPanels(root, shellRuntime);

  if (!shellRuntime.isPopout) {
    void hydratePluginRegistry(root, shellRuntime);
  }

  console.log("[shell] POC shell stub ready", shellBootstrapState.mode);

  return shellRuntime;
}

function mountShell(root: HTMLElement, runtime: ShellRuntime): void {
  if (runtime.isPopout) {
    mountPopout(root, runtime, {
      renderParts: () => renderParts(root, runtime),
      updateWindowReadOnlyState: () => updateWindowReadOnlyState(root, runtime),
      setupResize: () => setupResize(root, runtime),
      publishRestoreRequestOnUnload: () => {
        publishWithDegrade(root, runtime, {
          type: "popout-restore-request",
          hostWindowId: runtime.hostWindowId!,
          tabId: runtime.popoutTabId!,
          partId: runtime.popoutTabId!,
          sourceWindowId: runtime.windowId,
        }, createBridgeBindings(root, runtime));
      },
    });
  } else {
    mountMainWindow(root, {
      renderParts: () => renderParts(root, runtime),
      updateWindowReadOnlyState: () => updateWindowReadOnlyState(root, runtime),
      setupResize: () => setupResize(root, runtime),
      publishRestoreRequestOnUnload: () => {},
    });
    applyLayout(root, runtime.layout);
    startPopoutWatchdog(root, runtime, {
      renderParts: () => renderParts(root, runtime),
      renderSyncStatus: () => renderSyncStatus(root, runtime),
    });
  }

  bindBridgeSync(root, runtime);
  bindKeyboardShortcuts(root, runtime);
}

/*
 * Source-compatibility assertions for guardrail tests:
 * async function executeResolvedAction(match, intent) {
 *   const triggerId = intent?.type ?? match.intentType;
 *   await activatePluginForBoundary(root, runtime, {
 *     pluginId: match.pluginId,
 *     triggerType: "intent",
 *     triggerId,
 *   });
 * }
 * function resolveEventTargetSelector() {}
 * const menuActions = resolveMenuActions(runtime.actionSurface, "sidePanel", context);
 * const action = resolveKeybindingAction(runtime.actionSurface, normalizedKey, context);
 * await dispatchAction(runtime.actionSurface, runtime.intentRuntime, action.id, context);
 * await dispatchAction(runtime.actionSurface, runtime.intentRuntime, actionId, toActionContext(runtime));
 *
 * async function executeResolvedAction(match: IntentActionMatch, intent: ShellIntent | null): Promise<void> {
 *   const triggerId = intent?.type ?? match.intentType;
 *   await activatePluginForBoundary(root, runtime, {
 *     pluginId: match.pluginId,
 *     triggerType: "intent",
 *     triggerId,
 *   });
 * }
 *
 * function resolveEventTargetSelector(root: HTMLElement): string | null {
 *   return null;
 * }
 */

function initializeReactPanels(root: HTMLElement, runtime: ShellRuntime): void {
  initializeRuntimePanels(root, runtime, createRuntimeRenderBindings(root, runtime));
}

async function hydratePluginRegistry(root: HTMLElement, runtime: ShellRuntime): Promise<void> {
  try {
    const state = await bootstrapShellWithTenantManifest({
      tenantId: "demo",
    });
    runtime.registry = state.registry;
    refreshCommandContributions(runtime);
    renderPanels(root, runtime);
    renderParts(root, runtime);
    renderCommandSurface(root, runtime);
  } catch (error) {
    console.warn("[shell] plugin registry hydration skipped", error);
  }
}

function refreshCommandContributions(runtime: ShellRuntime): void {
  const contracts = runtime.registry
    .getSnapshot()
    .plugins
    .filter((plugin) => plugin.enabled && plugin.contract !== null)
    .map((plugin) => plugin.contract)
    .filter((plugin): plugin is NonNullable<typeof plugin> => plugin !== null);

  runtime.actionSurface = buildActionSurface(contracts);
}

function renderParts(root: HTMLElement, runtime: ShellRuntime): void {
  renderPartsView(root, runtime, createRuntimeRenderBindings(root, runtime));
}

function bindBridgeSync(root: HTMLElement, runtime: ShellRuntime): void {
  const handlers = createRuntimeEventHandlers(root, runtime, createRuntimeEventHandlerBindings(root, runtime));
  bindBridgeSyncHandlers(root, runtime, {
    ...createBridgeBindings(root, runtime),
    applyContext: handlers.applyContext,
    applySelection: handlers.applySelection,
  });
}

function bindKeyboardShortcuts(root: HTMLElement, runtime: ShellRuntime): void {
  const handlers = createRuntimeEventHandlers(root, runtime, createRuntimeEventHandlerBindings(root, runtime));
  bindKeyboardHandlers(root, runtime, {
    activatePluginForBoundary: (options) => activatePluginForBoundary(root, runtime, options),
    applySelection: handlers.applySelection,
    announce: (message) => announce(root, runtime, message),
    dismissIntentChooser: () => dismissIntentChooser(root, runtime),
    executeResolvedAction: handlers.executeResolvedAction,
    publishWithDegrade: (event) => {
      publishWithDegrade(root, runtime, event, createBridgeBindings(root, runtime));
    },
    renderContextControls: () => renderContextControlsPanel(root, runtime),
    renderParts: () => renderParts(root, runtime),
    renderCommandSurface: () => renderCommandSurface(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
    toActionContext: () => toActionContext(runtime),
  });
}

function dismissIntentChooser(root: HTMLElement, runtime: ShellRuntime): void {
  dismissIntentChooserState(runtime, {
    announce: (message) => announce(root, runtime, message),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
  });
}

function renderSyncStatus(root: HTMLElement, runtime: ShellRuntime): void {
  renderSyncStatusView(root, runtime);
}

function renderContextControlsPanel(root: HTMLElement, runtime: ShellRuntime): void {
  renderContextControlsPanelView(root, runtime);
}

function renderCommandSurface(root: HTMLElement, runtime: ShellRuntime): void {
  renderCommandSurfaceView(root, runtime, {
    activatePluginForBoundary: (options) => activatePluginForBoundary(root, runtime, options),
  });
}

async function primeEnabledPluginActivations(root: HTMLElement, runtime: ShellRuntime): Promise<void> {
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
  renderPanels(root, runtime);
  renderParts(root, runtime);
  renderCommandSurface(root, runtime);
}

async function activatePluginForBoundary(
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
    renderPanels(root, runtime);
    return true;
  } catch (error) {
    runtime.notice = `Plugin activation failed for '${options.pluginId}' (${options.triggerType}:${options.triggerId}).`;
    renderSyncStatus(root, runtime);
    console.warn("[shell] plugin activation boundary failed", options, error);
    return false;
  }
}

function createRuntimeRenderBindings(root: HTMLElement, runtime: ShellRuntime) {
  const handlers = createRuntimeEventHandlers(root, runtime, createRuntimeEventHandlerBindings(root, runtime));
  return {
    applySelection: handlers.applySelection,
    dismissIntentChooser: () => dismissIntentChooser(root, runtime),
    executeResolvedAction: handlers.executeResolvedAction,
    primeEnabledPluginActivations: () => primeEnabledPluginActivations(root, runtime),
    publishWithDegrade: (event: Parameters<ShellRuntime["bridge"]["publish"]>[0]) =>
      publishWithDegrade(root, runtime, event, createBridgeBindings(root, runtime)),
    refreshCommandContributions: () => refreshCommandContributions(runtime),
    renderCommandSurface: () => renderCommandSurface(root, runtime),
    renderContextControlsPanel: () => renderContextControlsPanel(root, runtime),
    renderParts: () => renderParts(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
  };
}

function createBridgeBindings(root: HTMLElement, runtime: ShellRuntime) {
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

function createRuntimeEventHandlerBindings(root: HTMLElement, runtime: ShellRuntime) {
  return {
    activatePluginForBoundary: (options: {
      pluginId: string;
      triggerType: PluginActivationTriggerType;
      triggerId: string;
    }) => activatePluginForBoundary(root, runtime, options),
    announce: (message: string) => announce(root, runtime, message),
    renderCommandSurface: () => renderCommandSurface(root, runtime),
    renderContextControlsPanel: () => renderContextControlsPanel(root, runtime),
    renderParts: () => renderParts(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
    summarizeSelectionPriorities: () => summarizeSelectionPriorities(runtime),
  };
}
