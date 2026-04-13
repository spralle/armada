import {
  createRevision,
  ensureTabsRegistered,
  updateContextState,
  readGroupSelectionContext,
} from "./context/runtime-state.js";
import {
  buildActionSurface,
} from "./action-surface.js";
import {
  createDefaultShellKeybindingContract,
  DEFAULT_SHELL_KEYBINDINGS,
  DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
  USER_KEYBINDING_OVERRIDE_PLUGIN_ID,
} from "./shell-runtime/default-shell-keybindings.js";
import {
  resolveChooserFocusRestoration,
} from "./keyboard-a11y.js";
import { shellBootstrapState } from "./app/bootstrap.js";
import { bootstrapShellWithTenantManifest } from "./app/bootstrap.js";
import {
  createShellBootstrapComposition,
  getShellBootstrapComposition,
  registerShellBootstrapComposition,
} from "./app/bootstrap-composition.js";
import {
  readShellMigrationFlags,
  selectShellTransportPath,
} from "./app/migration-flags.js";
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
import { getShellHmrRegistry } from "./shell-runtime/hmr-window-registry.js";
import { registerConfigurationServiceCapability } from "./config-service-registration.js";
import { createShellConfigService, runPersistenceMigrations } from "./config-service-setup.js";

export type {
  ShellCoreApi,
  ShellEffectsPort,
  ShellPartHostAdapter,
  ShellRendererAdapter,
} from "./app/contracts.js";

interface ShellMountState {
  windowId: string;
  dispose: () => void;
}

export function startShell(root: HTMLElement): ShellRuntime {
  const hmrRegistry = getShellHmrRegistry();
  hmrRegistry.byRoot.get(root)?.dispose();

  let disposed = false;
  const flags = readShellMigrationFlags();
  const transportDecision = selectShellTransportPath(flags);
  const shellRuntime = createShellRuntime({
    transportPath: transportDecision.path,
  });
  const composition = createShellBootstrapComposition(root, shellRuntime, flags, {
    activatePluginForBoundary: (options) => activatePluginForBoundary(root, shellRuntime, options),
    announce: (message) => announce(root, shellRuntime, message),
    dismissIntentChooser: () => dismissIntentChooser(root, shellRuntime),
    primeEnabledPluginActivations: () => primeEnabledPluginActivations(root, shellRuntime),
    publishWithDegrade: (event) => publishWithDegrade(root, shellRuntime, event, createBridgeBindings(root, shellRuntime)),
    refreshCommandContributions: () => refreshCommandContributions(shellRuntime),
    renderCommandSurface: () => renderCommandSurface(root, shellRuntime),
    renderContextControlsPanel: () => renderContextControlsPanel(root, shellRuntime),
    renderParts: () => renderParts(root, shellRuntime),
    renderSyncStatus: () => renderSyncStatus(root, shellRuntime),
    summarizeSelectionPriorities: () => summarizeSelectionPriorities(shellRuntime),
  });
  registerShellBootstrapComposition(shellRuntime, composition);
  const disposeMount = mountShell(root, shellRuntime, composition);
  shellRuntime.activeTransportPath = composition.transportPath;
  shellRuntime.activeTransportReason = composition.transportReason;
  registerRuntimeTeardown(shellRuntime);
  composition.initialize(root, shellRuntime);

  hmrRegistry.windowIds.add(shellRuntime.windowId);

  const mountState: ShellMountState = {
    windowId: shellRuntime.windowId,
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;
      disposeMount();
      shellRuntime.dragSessionBroker.dispose();
      shellRuntime.asyncBridge.close();
      shellRuntime.bridge.close();
      hmrRegistry.windowIds.delete(shellRuntime.windowId);
      if (hmrRegistry.byRoot.get(root)?.windowId === shellRuntime.windowId) {
        hmrRegistry.byRoot.delete(root);
      }
      console.info("[shell] window unregistered", shellRuntime.windowId, "count", hmrRegistry.windowIds.size);
    },
  };

  hmrRegistry.byRoot.set(root, mountState);

  if (!shellRuntime.isPopout) {
    void hydratePluginRegistry(root, shellRuntime, () => !disposed);
  }

  console.log("[shell] POC shell stub ready", {
    bootstrapMode: shellBootstrapState.mode,
    compositionMode: composition.mode,
    transportPath: shellRuntime.activeTransportPath,
    transportReason: shellRuntime.activeTransportReason,
    windowCount: hmrRegistry.windowIds.size,
  });

  return shellRuntime;
}

function registerRuntimeTeardown(runtime: ShellRuntime): void {
  let closed = false;
  const teardown = () => {
    if (closed) {
      return;
    }
    closed = true;
    runtime.asyncBridge.close();
    runtime.bridge.close();
  };

  window.addEventListener("beforeunload", teardown, { once: true });
}

function mountShell(root: HTMLElement, runtime: ShellRuntime, composition: ReturnType<typeof getShellBootstrapComposition>): () => void {
  const disposers: Array<() => void> = [];

  if (runtime.isPopout) {
    disposers.push(composition.mountPopout(root, runtime, {
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
    }));
  } else {
    disposers.push(composition.mountMainWindow(root, {
      renderParts: () => renderParts(root, runtime),
      updateWindowReadOnlyState: () => updateWindowReadOnlyState(root, runtime),
      setupResize: () => setupResize(root, runtime),
      publishRestoreRequestOnUnload: () => {},
    }));
    applyLayout(root, runtime.layout);
    disposers.push(startPopoutWatchdog(root, runtime, {
      renderParts: () => renderParts(root, runtime),
      renderSyncStatus: () => renderSyncStatus(root, runtime),
    }));
  }

  disposers.push(bindBridgeSync(root, runtime, {
    applyContext: composition.applyContext,
    applySelection: composition.applySelection,
  }));
  disposers.push(bindKeyboardShortcuts(root, runtime));

  return () => {
    for (const dispose of disposers) {
      dispose();
    }
  };
}

async function hydratePluginRegistry(root: HTMLElement, runtime: ShellRuntime, isActive: () => boolean): Promise<void> {
  try {
    const state = await bootstrapShellWithTenantManifest({
      tenantId: "demo",
      enableByDefault: true,
    });
    if (!isActive()) {
      return;
    }
    runtime.registry = state.registry;
    runtime.themeRegistry = state.themeRegistry ?? null;
    try {
      const { configService } = await createShellConfigService();
      registerConfigurationServiceCapability(runtime.registry, configService);
      const migrations = runPersistenceMigrations(configService);
      if (migrations.layout.migrated || migrations.context.migrated || migrations.keybindings.migrated) {
        console.info("[shell] persistence migrations completed", migrations);
      }
    } catch (configError) {
      console.warn("[shell] config service creation failed, continuing without it", configError);
    }
    runtime.registry.registerBuiltinPlugin(createDefaultShellKeybindingContract());
    refreshCommandContributions(runtime);
    getShellBootstrapComposition(runtime).renderPanels(root, runtime);
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
  getShellBootstrapComposition(runtime).renderParts(root, runtime);
}

function bindBridgeSync(
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

function bindKeyboardShortcuts(root: HTMLElement, runtime: ShellRuntime): () => void {
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
    renderParts: () => renderParts(root, runtime),
    renderCommandSurface: () => renderCommandSurface(root, runtime),
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
  });
}

function dismissIntentChooser(root: HTMLElement, runtime: ShellRuntime): void {
  dismissIntentChooserState(runtime, {
    announce: (message) => announce(root, runtime, message),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
  });
}

function renderSyncStatus(root: HTMLElement, runtime: ShellRuntime): void {
  getShellBootstrapComposition(runtime).renderSyncStatus(root, runtime);
}

function renderContextControlsPanel(root: HTMLElement, runtime: ShellRuntime): void {
  getShellBootstrapComposition(runtime).renderContextControlsPanel(root, runtime);
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
  getShellBootstrapComposition(runtime).renderPanels(root, runtime);
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
    getShellBootstrapComposition(runtime).renderPanels(root, runtime);
    return true;
  } catch (error) {
    runtime.notice = `Plugin activation failed for '${options.pluginId}' (${options.triggerType}:${options.triggerId}).`;
    renderSyncStatus(root, runtime);
    console.warn("[shell] plugin activation boundary failed", options, error);
    return false;
  }
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
