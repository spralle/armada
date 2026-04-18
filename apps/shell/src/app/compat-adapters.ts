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
  mountMainWindow,
  mountPopout,
} from "../ui/shell-mount.js";
import { createEdgeSlotRenderer } from "../ui/edge-slot-renderer.js";
import { createLayerSurfaceRenderer } from "../layer/surface-renderer.js";
import { getLayerRegistry } from "../ui/shell-mount.js";
import { createShellFederationRuntime } from "../federation-runtime.js";
import { createDefaultEdgeSlotsLayout } from "../layout.js";

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
  let layerSurfaceRendererInstance: import("../layer/surface-renderer.js").LayerSurfaceRenderer | null = null;

  const effects: ShellEffectsPort = {
    activatePluginForBoundary: (options) => deps.activatePluginForBoundary(options),
    announce: (message) => deps.announce(message),
    publishWithDegrade: (event) => deps.publishWithDegrade(event),
    renderContextControlsPanel: () => renderer.renderContextControlsPanel(root, runtime),
    renderParts: () => renderer.renderParts(root, runtime),
    renderSyncStatus: () => renderer.renderSyncStatus(root, runtime),
    summarizeSelectionPriorities: () => deps.summarizeSelectionPriorities(),
  };

  const runtimeHandlers = createRuntimeEventHandlers(root, runtime, {
    activatePluginForBoundary: (options) => effects.activatePluginForBoundary(options),
    announce: (message) => effects.announce(message),
    renderContextControlsPanel: () => effects.renderContextControlsPanel(),
    renderParts: () => effects.renderParts(),
    renderSyncStatus: () => effects.renderSyncStatus(),
    summarizeSelectionPriorities: () => effects.summarizeSelectionPriorities(),
  });

  const core = createShellCoreApi(runtime, runtimeHandlers);

  const federationRuntime = createShellFederationRuntime();

  const edgeSlotRenderer = createEdgeSlotRenderer({
    federationRuntime,
  });

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
        renderContextControlsPanel: () => effects.renderContextControlsPanel(),
        renderParts: () => effects.renderParts(),
        renderSyncStatus: () => effects.renderSyncStatus(),
      });
    },
    renderSyncStatus: (viewRoot, viewRuntime) => {
      renderSyncStatusView(viewRoot, viewRuntime);
    },
    renderEdgeSlots: (viewRoot, viewRuntime) => {
      edgeSlotRenderer.renderEdgeSlots(viewRoot, viewRuntime);
    },
    renderLayerSurfaces: (viewRoot, viewRuntime) => {
      const layerRegistry = getLayerRegistry();
      if (!layerRegistry) return;
      const layerHost = viewRoot.querySelector<HTMLElement>("#layer-host");
      if (!layerHost) return;
      // Lazily create the renderer on first call, reuse thereafter
      if (!layerSurfaceRendererInstance) {
        layerSurfaceRendererInstance = createLayerSurfaceRenderer({
          federationRuntime,
          layerRegistry,
          layerHost,
        });
      }
      layerSurfaceRendererInstance.renderLayerSurfaces(viewRuntime);
    },
  };

  const partHost: ShellPartHostAdapter = {
    syncRenderedParts: (viewRoot, parts) => runtime.partHost.syncRenderedParts(viewRoot, parts),
    unmountAll: () => runtime.partHost.unmountAll(),
  };

  // Toggle action stays shell-side — it needs runtime.layout access.
  runtime.runtimeActionRegistry.set("shell.topbar.toggle", () => {
    if (!runtime.layout.edgeSlots) {
      runtime.layout = { ...runtime.layout, edgeSlots: createDefaultEdgeSlotsLayout() };
    }
    const edgeSlots = runtime.layout.edgeSlots!;
    edgeSlots.top.visible = !edgeSlots.top.visible;
    runtime.layout = { ...runtime.layout, edgeSlots };
  });

  return {
    core,
    effects,
    renderer,
    partHost,
  };
}
