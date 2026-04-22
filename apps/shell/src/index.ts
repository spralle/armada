import {
  readGroupSelectionContext,
  writeGroupSelectionContext,
} from "./context/runtime-state.js";
import {
  createDefaultShellKeybindingContract,
} from "./shell-runtime/default-shell-keybindings.js";
import { shellBootstrapState } from "./app/bootstrap.js";
import { bootstrapShellWithTenantManifest } from "./app/bootstrap.js";
import {
  createShellBootstrap,
  getShellBootstrap,
  registerShellBootstrap,
} from "./bootstrap-shell.js";
import type { ShellBootstrap } from "./bootstrap-shell.js";
import {
  readShellMigrationFlags,
  selectShellTransportPath,
} from "./app/migration-flags.js";
import { createShellRuntime } from "./app/runtime.js";
import type { ShellRuntime } from "./app/types.js";
import {
  startPopoutWatchdog,
} from "./ui/parts-controller.js";
import {
  updateWindowReadOnlyState,
} from "./ui/context-controls.js";
import { applyLayout, setupResize } from "./shell-runtime/layout-helpers.js";
import {
  publishWithDegrade,
} from "./shell-runtime/bridge-sync-handlers.js";
import { registerWorkspaceRuntimeActions } from "./shell-runtime/workspace-runtime-actions.js";
import { getShellHmrRegistry } from "./shell-runtime/hmr-window-registry.js";
import { registerConfigurationServiceCapability } from "./config-service-registration.js";
import { createShellConfigService, runPersistenceMigrations } from "./config-service-setup.js";
import { createPluginServicesBridge } from "./plugin-service-bridge.js";
import { createQuickPickBridge } from "./ui/quick-pick/quick-pick-bridge.js";
import { createGhostApiDeps } from "./plugin-api/ghost-api-deps-factory.js";
import {
  activatePluginForBoundary,
  announce,
  bindBridgeSync,
  bindKeyboardShortcuts,
  createBridgeBindings,
  createWorkspaceSwitchDeps,
  dismissIntentChooser,
  primeEnabledPluginActivations,
  refreshCommandContributions,
  renderContextControlsPanel,
  renderParts,
  renderSyncStatus,
  summarizeSelectionPriorities,
} from "./shell-wiring.js";

export type {
  ShellCoreApi,
  ShellPartHostAdapter,
} from "./app/contracts.js";

declare global {
  interface Window {
    __g?: {
      runtime: ShellRuntime;
      services: ShellRuntime['services'];
      registry: ShellRuntime['registry'];
    };
  }
}

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
  const bootstrap = createShellBootstrap(root, shellRuntime, flags, {
    activatePluginForBoundary: (options) => activatePluginForBoundary(root, shellRuntime, options),
    announce: (message) => announce(root, shellRuntime, message),
    dismissIntentChooser: () => dismissIntentChooser(root, shellRuntime),
    primeEnabledPluginActivations: () => primeEnabledPluginActivations(root, shellRuntime),
    publishWithDegrade: (event) => publishWithDegrade(root, shellRuntime, event, createBridgeBindings(root, shellRuntime)),
    refreshCommandContributions: () => refreshCommandContributions(shellRuntime),
    renderContextControlsPanel: () => renderContextControlsPanel(root, shellRuntime),
    renderParts: () => renderParts(root, shellRuntime),
    renderSyncStatus: () => renderSyncStatus(root, shellRuntime),
    summarizeSelectionPriorities: () => summarizeSelectionPriorities(shellRuntime),
  });
  registerShellBootstrap(shellRuntime, bootstrap);
  registerWorkspaceRuntimeActions(shellRuntime, {
    getWorkspaceSwitchDeps: () => createWorkspaceSwitchDeps(root, shellRuntime),
  });
  const disposeMount = mountShell(root, shellRuntime, bootstrap);
  shellRuntime.activeTransportPath = bootstrap.transportPath;
  shellRuntime.activeTransportReason = bootstrap.transportReason;
  registerRuntimeTeardown(shellRuntime);

  window.__g = {
    runtime: shellRuntime,
    get services() { return shellRuntime.services; },
    get registry() { return shellRuntime.registry; },
  };
  console.debug("[shell] __g namespace available — try: __g.runtime, __g.services, __g.registry");

  bootstrap.initialize(root, shellRuntime);

  hmrRegistry.windowIds.add(shellRuntime.windowId);

  const mountState: ShellMountState = {
    windowId: shellRuntime.windowId,
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;
      disposeMount();
      shellRuntime.registrySubscriptionDispose?.();
      shellRuntime.registrySubscriptionDispose = null;
      shellRuntime.pluginConfigSyncDispose?.();
      shellRuntime.pluginConfigSyncDispose = null;
      shellRuntime.dragSessionBroker.dispose();
      shellRuntime.asyncBridge.close();
      shellRuntime.bridge.close();
      hmrRegistry.windowIds.delete(shellRuntime.windowId);
      if (hmrRegistry.byRoot.get(root)?.windowId === shellRuntime.windowId) {
        hmrRegistry.byRoot.delete(root);
      }
      console.info("[shell] window unregistered", shellRuntime.windowId, "count", hmrRegistry.windowIds.size);
      if (window.__g?.runtime === shellRuntime) {
        delete window.__g;
      }
    },
  };

  hmrRegistry.byRoot.set(root, mountState);

  if (!shellRuntime.isPopout) {
    void hydratePluginRegistry(root, shellRuntime, () => !disposed);
  }

  console.log("[shell] POC shell stub ready", {
    bootstrapMode: shellBootstrapState.mode,
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

function mountShell(root: HTMLElement, runtime: ShellRuntime, bootstrap: ShellBootstrap): () => void {
  const disposers: Array<() => void> = [];

  if (runtime.isPopout) {
    disposers.push(bootstrap.mountPopout(root, runtime, {
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
    disposers.push(bootstrap.mountMainWindow(root, {
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
    applyContext: bootstrap.core.applyContext,
    applySelection: bootstrap.core.applySelection,
  }));
  disposers.push(bindKeyboardShortcuts(root, runtime));

  return () => {
    for (const dispose of disposers) {
      dispose();
    }
  };
}

async function hydratePluginRegistry(root: HTMLElement, runtime: ShellRuntime, isActive: () => boolean): Promise<void> {
  const modalLayer = root.querySelector<HTMLElement>('.shell-layer[data-layer="modal"]');
  const quickPickBridge = createQuickPickBridge(modalLayer ?? undefined);
  try {
    const apiDeps = createGhostApiDeps(runtime, quickPickBridge, {
      getWorkspaceSwitchDeps: () => createWorkspaceSwitchDeps(root, runtime),
    });
    const { configService } = await createShellConfigService();
    const state = await bootstrapShellWithTenantManifest({
      tenantId: "demo",
      configurationService: configService,
      enableByDefault: true,
      defaultThemeId: "ghost.theme.tokyo-night",
      apiDeps,
      syncStatusDeps: {
        isSyncDegraded: () => runtime.syncDegraded,
      },
      contextServiceDeps: {
        getGroupSelectionContext: () => readGroupSelectionContext(runtime),
        applyContextValue: (_key, value) => {
          if (!runtime.syncDegraded) {
            writeGroupSelectionContext(runtime, value);
          }
        },
      },
      keybindingServiceDeps: {
        getOverrideManager: () => runtime.keybindingOverrideManager,
        getKeybindings: () => runtime.actionSurface.keybindings,
      },
      onProgress: (registry) => {
        if (!isActive()) return;
        runtime.registry = registry;
        getShellBootstrap(runtime).renderPanels(root, runtime);
      },
    });
    if (!isActive()) {
      state.disposePluginConfigSync?.();
      quickPickBridge.dispose();
      return;
    }
    runtime.registry = state.registry;
    runtime.services = createPluginServicesBridge(state.registry);
    runtime.pluginConfigSyncDispose = state.disposePluginConfigSync;
    runtime.themeRegistry = state.themeRegistry ?? null;
    try {
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
    // Subscribe to plugin registry changes to re-render UI on enable/disable.
    // Uses microtask batching to coalesce rapid notifications (e.g. cascade-disable).
    let renderPending = false;
    const registrySub = runtime.registry.subscribe(() => {
      if (renderPending) return;
      renderPending = true;
      queueMicrotask(() => {
        renderPending = false;
        if (!isActive()) return;
        refreshCommandContributions(runtime);
        runtime.themeRegistry?.pruneDisabledPluginThemes();
        runtime.themeRegistry?.discoverThemes();
        getShellBootstrap(runtime).renderPanels(root, runtime);
        renderParts(root, runtime);
        getShellBootstrap(runtime).renderEdgeSlots(root, runtime);
        getShellBootstrap(runtime).renderLayerSurfaces(root, runtime);
      });
    });
    runtime.registrySubscriptionDispose = () => registrySub.dispose();
    getShellBootstrap(runtime).renderPanels(root, runtime);
    renderParts(root, runtime);
    getShellBootstrap(runtime).renderEdgeSlots(root, runtime);
    getShellBootstrap(runtime).renderLayerSurfaces(root, runtime);
  } catch (error) {
    quickPickBridge.dispose();
    console.warn("[shell] plugin registry hydration skipped", error);
  }
}

