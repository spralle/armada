import {
  CORE_GROUP_CONTEXT_KEY,
  createRevision,
  ensureTabsRegistered,
  reconcileActiveTab,
  updateContextState,
  writeGroupSelectionContext,
} from "../context/runtime-state.js";
import { getTabGroupId } from "../context-state.js";
import type { BridgeHost, ShellRuntime } from "../app/types.js";
import { buildGroupContextSyncEvent } from "@ghost-shell/bridge";
import { createReactPanelsHost } from "../ui/react/panels-host.js";
import { getVisibleComposedParts } from "../ui/parts-rendering.js";
import { renderParts as renderPartsView } from "../ui/parts-controller.js";
import { updateWindowReadOnlyState } from "../ui/context-controls.js";
import { deriveCloseableTabIds } from "./runtime-render-transition.js";
import type { PluginActivationTriggerType } from "../plugin-registry.js";

type ReactPanelsHost = ReturnType<typeof createReactPanelsHost>;

const panelsByRuntime = new WeakMap<ShellRuntime, ReactPanelsHost>();

export interface RuntimeRenderBindings {
  activatePluginForBoundary: (options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  }) => Promise<boolean>;
  applySelection: (event: import("@ghost-shell/bridge").SelectionSyncEvent) => void;
  dismissIntentChooser: () => void;
  executeResolvedAction: (
    match: import("@ghost-shell/intents").IntentActionMatch,
    intent: import("@ghost-shell/intents").ShellIntent | null,
  ) => Promise<void>;
  primeEnabledPluginActivations: () => Promise<void>;
  publishWithDegrade: (event: Parameters<BridgeHost["bridge"]["publish"]>[0]) => void;
  refreshCommandContributions: () => void;
  renderContextControlsPanel: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
}

export function initializeReactPanels(
  root: HTMLElement,
  runtime: ShellRuntime,
  bindings: RuntimeRenderBindings,
): void {
  const host = createReactPanelsHost(root, runtime, {
    onApplyContextValue: (value) => {
      if (runtime.syncDegraded) {
        return;
      }

      const activeTabId = reconcileActiveTab(runtime);
      if (!activeTabId) {
        return;
      }

      writeGroupSelectionContext(runtime, value);
      const groupId = getTabGroupId(runtime.contextState, activeTabId) ?? undefined;
      bindings.publishWithDegrade(buildGroupContextSyncEvent({
        tabId: activeTabId,
        groupId,
        contextKey: CORE_GROUP_CONTEXT_KEY,
        contextValue: value,
        revision: createRevision(runtime.windowId),
        sourceWindowId: runtime.windowId,
      }));
      bindings.renderSyncStatus();
    },
    onChooseIntentAction: async (index) => {
      if (!runtime.activeIntentSession) {
        return;
      }
      runtime.activeIntentSession.chooserFocusIndex = index;
      const selectedMatch = runtime.activeIntentSession.matches[index];
      if (!selectedMatch) {
        return;
      }
      if (runtime._pendingChooserResolve) {
        runtime._pendingChooserResolve(selectedMatch);
      } else {
        await bindings.executeResolvedAction(selectedMatch, runtime.activeIntentSession.intent);
      }
    },
    onDismissChooser: () => {
      bindings.dismissIntentChooser();
    },
    onPendingFocusApplied: () => {
      runtime.pendingFocusSelector = null;
    },
  });

  panelsByRuntime.set(runtime, host);
  bindings.refreshCommandContributions();
  renderPanels(root, runtime);
}

export function renderPanels(root: HTMLElement, runtime: ShellRuntime): void {
  const host = panelsByRuntime.get(runtime);
  if (!host) {
    return;
  }

  host.render();
  updateWindowReadOnlyState(root, runtime);
}

export function renderParts(root: HTMLElement, runtime: ShellRuntime, bindings: RuntimeRenderBindings): void {
  void bindings.primeEnabledPluginActivations();
  const visibleParts = getVisibleComposedParts(runtime);
  runtime.closeableTabIds = deriveCloseableTabIds(visibleParts);
  updateContextState(runtime, ensureTabsRegistered(runtime.contextState, visibleParts));
  reconcileActiveTab(runtime);
  renderPartsView(root, runtime, {
    applySelection: (event) => bindings.applySelection(event),
    partHost: runtime.partHost,
    publishWithDegrade: (event) => {
      bindings.publishWithDegrade(event);
    },
    renderContextControls: () => bindings.renderContextControlsPanel(),
    renderParts: () => bindings.renderParts(),
    renderSyncStatus: () => bindings.renderSyncStatus(),
  });
  updateWindowReadOnlyState(root, runtime);
}

export function renderSyncStatus(root: HTMLElement, runtime: ShellRuntime): void {
  renderPanels(root, runtime);
}

export function renderContextControlsPanel(root: HTMLElement, runtime: ShellRuntime): void {
  renderPanels(root, runtime);
}

export function renderDevContextInspector(root: HTMLElement, runtime: ShellRuntime): void {
  renderPanels(root, runtime);
}
