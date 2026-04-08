import { mountMainWindow, mountPopout } from "../ui/shell-mount.js";
import { createRuntimeEventHandlers } from "../shell-runtime/runtime-event-handlers.js";
import {
  initializeReactPanels,
  renderContextControlsPanel as renderContextControlsPanelView,
  renderPanels as renderPanelsView,
  renderParts as renderPartsView,
  renderSyncStatus as renderSyncStatusView,
} from "../shell-runtime/runtime-render.js";
import { createShellRuntimeCompatibilityAdapters } from "./compat-adapters.js";
import type { ShellMigrationFlags } from "./migration-flags.js";
import { selectShellTransportPath, shouldUseContractComposition } from "./migration-flags.js";
import type { ShellRuntime } from "./types.js";
import type { PluginActivationTriggerType } from "../plugin-registry.js";
import type { WindowBridgeEvent } from "../window-bridge.js";

type PublishEvent = WindowBridgeEvent;

export interface ShellBootstrapComposition {
  mode: "baseline" | "contract";
  transportPath: "legacy-bridge" | "async-scomp-adapter";
  transportReason: "kill-switch-force-legacy" | "async-flag-enabled" | "default-legacy";
  applyContext: ReturnType<typeof createRuntimeEventHandlers>["applyContext"];
  applySelection: ReturnType<typeof createRuntimeEventHandlers>["applySelection"];
  initialize: (root: HTMLElement, runtime: ShellRuntime) => void;
  mountMainWindow: Parameters<typeof mountMainWindow>[1] extends infer T
    ? (root: HTMLElement, deps: T) => () => void
    : never;
  mountPopout: Parameters<typeof mountPopout>[2] extends infer T
    ? (root: HTMLElement, runtime: ShellRuntime, deps: T) => () => void
    : never;
  renderPanels: (root: HTMLElement, runtime: ShellRuntime) => void;
  renderParts: (root: HTMLElement, runtime: ShellRuntime) => void;
  renderSyncStatus: (root: HTMLElement, runtime: ShellRuntime) => void;
  renderContextControlsPanel: (root: HTMLElement, runtime: ShellRuntime) => void;
}

export interface ShellBootstrapRuntimeDeps {
  activatePluginForBoundary: (options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  }) => Promise<boolean>;
  announce: (message: string) => void;
  dismissIntentChooser: () => void;
  primeEnabledPluginActivations: () => Promise<void>;
  publishWithDegrade: (event: PublishEvent) => void;
  refreshCommandContributions: () => void;
  summarizeSelectionPriorities: () => string;
  renderCommandSurface: () => void;
  renderContextControlsPanel: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
}

const compositionByRuntime = new WeakMap<ShellRuntime, ShellBootstrapComposition>();

export function registerShellBootstrapComposition(runtime: ShellRuntime, composition: ShellBootstrapComposition): void {
  compositionByRuntime.set(runtime, composition);
}

export function getShellBootstrapComposition(runtime: ShellRuntime): ShellBootstrapComposition {
  const composition = compositionByRuntime.get(runtime);
  if (!composition) {
    throw new Error("Shell bootstrap composition is not initialized for runtime.");
  }

  return composition;
}

export function createShellBootstrapComposition(
  root: HTMLElement,
  runtime: ShellRuntime,
  flags: ShellMigrationFlags,
  deps: ShellBootstrapRuntimeDeps,
): ShellBootstrapComposition {
  const transportDecision = selectShellTransportPath(flags);

  if (shouldUseContractComposition(flags)) {
    const adapters = createShellRuntimeCompatibilityAdapters(root, runtime, {
      activatePluginForBoundary: (options) => deps.activatePluginForBoundary(options),
      announce: (message) => deps.announce(message),
      dismissIntentChooser: () => deps.dismissIntentChooser(),
      primeEnabledPluginActivations: () => deps.primeEnabledPluginActivations(),
      publishWithDegrade: (event) => deps.publishWithDegrade(event),
      refreshCommandContributions: () => deps.refreshCommandContributions(),
      summarizeSelectionPriorities: () => deps.summarizeSelectionPriorities(),
    });

    return {
      mode: "contract",
      transportPath: transportDecision.path,
      transportReason: transportDecision.reason,
      applyContext: adapters.core.applyContext,
      applySelection: adapters.core.applySelection,
      initialize: (viewRoot, viewRuntime) => {
        adapters.renderer.initialize(viewRoot, viewRuntime, adapters.effects);
      },
      mountMainWindow: (viewRoot, mountDeps) => {
        return adapters.renderer.mountMainWindow(viewRoot, mountDeps);
      },
      mountPopout: (viewRoot, viewRuntime, mountDeps) => {
        return adapters.renderer.mountPopout(viewRoot, viewRuntime, mountDeps);
      },
      renderPanels: (viewRoot, viewRuntime) => {
        adapters.renderer.renderPanels(viewRoot, viewRuntime);
      },
      renderParts: (viewRoot, viewRuntime) => {
        adapters.renderer.renderParts(viewRoot, viewRuntime);
      },
      renderSyncStatus: (viewRoot, viewRuntime) => {
        adapters.renderer.renderSyncStatus(viewRoot, viewRuntime);
      },
      renderContextControlsPanel: (viewRoot, viewRuntime) => {
        adapters.renderer.renderContextControlsPanel(viewRoot, viewRuntime);
      },
    };
  }

  const handlers = createRuntimeEventHandlers(root, runtime, {
    activatePluginForBoundary: (options) => deps.activatePluginForBoundary(options),
    announce: (message) => deps.announce(message),
    renderCommandSurface: () => deps.renderCommandSurface(),
    renderContextControlsPanel: () => deps.renderContextControlsPanel(),
    renderParts: () => deps.renderParts(),
    renderSyncStatus: () => deps.renderSyncStatus(),
    summarizeSelectionPriorities: () => deps.summarizeSelectionPriorities(),
  });

  return {
    mode: "baseline",
    transportPath: transportDecision.path,
    transportReason: transportDecision.reason,
    applyContext: handlers.applyContext,
    applySelection: handlers.applySelection,
    initialize: (viewRoot, viewRuntime) => {
      initializeReactPanels(viewRoot, viewRuntime, {
        applySelection: (event) => handlers.applySelection(event),
        dismissIntentChooser: () => deps.dismissIntentChooser(),
        executeResolvedAction: (match, intent) => handlers.executeResolvedAction(match, intent),
        primeEnabledPluginActivations: () => deps.primeEnabledPluginActivations(),
        publishWithDegrade: (event) => deps.publishWithDegrade(event),
        refreshCommandContributions: () => deps.refreshCommandContributions(),
        renderCommandSurface: () => deps.renderCommandSurface(),
        renderContextControlsPanel: () => deps.renderContextControlsPanel(),
        renderParts: () => deps.renderParts(),
        renderSyncStatus: () => deps.renderSyncStatus(),
      });
    },
    mountMainWindow: (viewRoot, mountDeps) => {
      return mountMainWindow(viewRoot, mountDeps);
    },
    mountPopout: (viewRoot, viewRuntime, mountDeps) => {
      return mountPopout(viewRoot, viewRuntime, mountDeps);
    },
    renderPanels: (viewRoot, viewRuntime) => {
      renderPanelsView(viewRoot, viewRuntime);
    },
    renderParts: (viewRoot, viewRuntime) => {
      renderPartsView(viewRoot, viewRuntime, {
        applySelection: (event) => handlers.applySelection(event),
        dismissIntentChooser: () => deps.dismissIntentChooser(),
        executeResolvedAction: (match, intent) => handlers.executeResolvedAction(match, intent),
        primeEnabledPluginActivations: () => deps.primeEnabledPluginActivations(),
        publishWithDegrade: (event) => deps.publishWithDegrade(event),
        refreshCommandContributions: () => deps.refreshCommandContributions(),
        renderCommandSurface: () => deps.renderCommandSurface(),
        renderContextControlsPanel: () => deps.renderContextControlsPanel(),
        renderParts: () => deps.renderParts(),
        renderSyncStatus: () => deps.renderSyncStatus(),
      });
    },
    renderSyncStatus: (viewRoot, viewRuntime) => {
      renderSyncStatusView(viewRoot, viewRuntime);
    },
    renderContextControlsPanel: (viewRoot, viewRuntime) => {
      renderContextControlsPanelView(viewRoot, viewRuntime);
    },
  };
}
