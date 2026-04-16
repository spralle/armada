import type {
  ShellCoreApi,
  ShellEffectsPort,
  ShellPartHostAdapter,
  ShellRendererAdapter,
} from "./contracts.js";
import type { ShellRuntime } from "./types.js";
import type { PluginActivationTriggerType } from "../plugin-registry.js";
import type { WindowBridgeEvent } from "../window-bridge.js";
import { createRuntimeEventHandlers } from "../shell-runtime/runtime-event-handlers.js";
import { createShellCoreApi } from "./shell-core.js";
import {
  initializeReactPanels,
  renderPanels as renderPanelsView,
  renderContextControlsPanel as renderContextControlsPanelView,
  renderParts as renderPartsView,
  renderSyncStatus as renderSyncStatusView,
} from "../shell-runtime/runtime-render.js";
import {
  renderCommandSurface as renderCommandSurfaceView,
} from "../shell-runtime/command-surface-render.js";
import {
  mountMainWindow,
  mountPopout,
} from "../ui/shell-mount.js";

interface ShellCompatibilityAdapterDeps {
  activatePluginForBoundary: (options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  }) => Promise<boolean>;
  announce: (message: string) => void;
  dismissIntentChooser: () => void;
  primeEnabledPluginActivations: () => Promise<void>;
  publishWithDegrade: (event: WindowBridgeEvent) => void;
  refreshCommandContributions: () => void;
  summarizeSelectionPriorities: () => string;
}

export interface ShellRuntimeCompatibilityAdapters {
  core: ShellCoreApi;
  effects: ShellEffectsPort;
  renderer: ShellRendererAdapter;
  partHost: ShellPartHostAdapter;
}

export function createShellRuntimeCompatibilityAdapters(
  root: HTMLElement,
  runtime: ShellRuntime,
  deps: ShellCompatibilityAdapterDeps,
): ShellRuntimeCompatibilityAdapters {
  let renderer: ShellRendererAdapter;

  const effects: ShellEffectsPort = {
    activatePluginForBoundary: (options) => deps.activatePluginForBoundary(options),
    announce: (message) => deps.announce(message),
    publishWithDegrade: (event) => deps.publishWithDegrade(event),
    renderCommandSurface: () => renderer.renderCommandSurface(root, runtime),
    renderContextControlsPanel: () => renderer.renderContextControlsPanel(root, runtime),
    renderParts: () => renderer.renderParts(root, runtime),
    renderSyncStatus: () => renderer.renderSyncStatus(root, runtime),
    summarizeSelectionPriorities: () => deps.summarizeSelectionPriorities(),
  };

  const runtimeHandlers = createRuntimeEventHandlers(root, runtime, {
    activatePluginForBoundary: (options) => effects.activatePluginForBoundary(options),
    announce: (message) => effects.announce(message),
    renderCommandSurface: () => effects.renderCommandSurface(),
    renderContextControlsPanel: () => effects.renderContextControlsPanel(),
    renderParts: () => effects.renderParts(),
    renderSyncStatus: () => effects.renderSyncStatus(),
    summarizeSelectionPriorities: () => effects.summarizeSelectionPriorities(),
  });

  const core = createShellCoreApi(runtime, runtimeHandlers);

  renderer = {
    initialize: (viewRoot, viewRuntime) => {
      initializeReactPanels(viewRoot, viewRuntime, {
        activatePluginForBoundary: (options) => effects.activatePluginForBoundary(options),
        applySelection: (event) => core.applySelection(event),
        dismissIntentChooser: () => deps.dismissIntentChooser(),
        executeResolvedAction: (match, intent) => core.executeResolvedAction(match, intent),
        primeEnabledPluginActivations: () => deps.primeEnabledPluginActivations(),
        publishWithDegrade: (event) => effects.publishWithDegrade(event),
        refreshCommandContributions: () => deps.refreshCommandContributions(),
        renderCommandSurface: () => effects.renderCommandSurface(),
        renderContextControlsPanel: () => effects.renderContextControlsPanel(),
        renderParts: () => effects.renderParts(),
        renderSyncStatus: () => effects.renderSyncStatus(),
      });
    },
    mountMainWindow: (viewRoot, deps) => {
      return mountMainWindow(viewRoot, deps);
    },
    mountPopout: (viewRoot, viewRuntime, deps) => {
      return mountPopout(viewRoot, viewRuntime, deps);
    },
    renderPanels: (viewRoot, viewRuntime) => {
      renderPanelsView(viewRoot, viewRuntime);
    },
    renderCommandSurface: (viewRoot, viewRuntime) => {
      renderCommandSurfaceView(viewRoot, viewRuntime, {
        activatePluginForBoundary: (options) => effects.activatePluginForBoundary(options),
      });
    },
    renderContextControlsPanel: (viewRoot, viewRuntime) => {
      renderContextControlsPanelView(viewRoot, viewRuntime);
    },
    renderParts: (viewRoot, viewRuntime) => {
      renderPartsView(viewRoot, viewRuntime, {
        activatePluginForBoundary: (options) => effects.activatePluginForBoundary(options),
        applySelection: (event) => core.applySelection(event),
        dismissIntentChooser: () => deps.dismissIntentChooser(),
        executeResolvedAction: (match, intent) => core.executeResolvedAction(match, intent),
        primeEnabledPluginActivations: () => deps.primeEnabledPluginActivations(),
        publishWithDegrade: (event) => effects.publishWithDegrade(event),
        refreshCommandContributions: () => deps.refreshCommandContributions(),
        renderCommandSurface: () => effects.renderCommandSurface(),
        renderContextControlsPanel: () => effects.renderContextControlsPanel(),
        renderParts: () => effects.renderParts(),
        renderSyncStatus: () => effects.renderSyncStatus(),
      });
    },
    renderSyncStatus: (viewRoot, viewRuntime) => {
      renderSyncStatusView(viewRoot, viewRuntime);
    },
    renderEdgeSlots: (_viewRoot, _viewRuntime) => {
      // No-op — edge slot rendering implemented in armada-vee5
    },
  };

  const partHost: ShellPartHostAdapter = {
    syncRenderedParts: (viewRoot, parts) => runtime.partHost.syncRenderedParts(viewRoot, parts),
    unmountAll: () => runtime.partHost.unmountAll(),
  };

  return {
    core,
    effects,
    renderer,
    partHost,
  };
}
