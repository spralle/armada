import {
  CORE_GROUP_CONTEXT_KEY,
  createRevision,
  ensureTabsRegistered,
  reconcileActiveTab,
  updateContextState,
  writeGroupSelectionContext,
} from "../context/runtime-state.js";
import { getTabGroupId } from "../context-state.js";
import type { ShellRuntime } from "../app/types.js";
import { buildGroupContextSyncEvent } from "../sync/bridge-payloads.js";
import { createReactPanelsHost } from "../ui/react/panels-host.js";
import { getVisibleComposedParts, getVisiblePartDefinitions } from "../ui/parts-rendering.js";
import { renderParts as renderPartsView } from "../ui/parts-controller.js";
import { updateWindowReadOnlyState } from "../ui/context-controls.js";

type ReactPanelsHost = ReturnType<typeof createReactPanelsHost>;

const panelsByRuntime = new WeakMap<ShellRuntime, ReactPanelsHost>();

export interface RuntimeRenderBindings {
  applySelection: (event: import("../window-bridge.js").SelectionSyncEvent) => void;
  dismissIntentChooser: () => void;
  executeResolvedAction: (
    match: import("../intent-runtime.js").IntentActionMatch,
    intent: import("../intent-runtime.js").ShellIntent | null,
  ) => Promise<void>;
  primeEnabledPluginActivations: () => Promise<void>;
  publishWithDegrade: (event: Parameters<ShellRuntime["bridge"]["publish"]>[0]) => boolean;
  refreshCommandContributions: () => void;
  renderCommandSurface: () => void;
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
    onTogglePlugin: async (pluginId, enabled) => {
      try {
        runtime.pluginNotice = "";
        await runtime.registry.setEnabled(pluginId, enabled);
        bindings.refreshCommandContributions();
      } catch (error) {
        runtime.pluginNotice = `Unable to toggle plugin '${pluginId}'. See console diagnostics.`;
        console.error("[shell] failed to toggle plugin", pluginId, error);
      }

      renderPanels(root, runtime);
      bindings.renderParts();
      bindings.renderCommandSurface();
    },
    onChooseIntentAction: async (index) => {
      runtime.chooserFocusIndex = index;
      const selectedMatch = runtime.pendingIntentMatches[index];
      if (!selectedMatch) {
        return;
      }
      await bindings.executeResolvedAction(selectedMatch, runtime.pendingIntent);
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
  bindings.renderCommandSurface();
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
  const visibleDefinitions = getVisiblePartDefinitions(runtime);
  const visibleDefinitionById = new Map(visibleDefinitions.map((part) => [part.definitionId, part]));
  const registrationRefs = runtime.contextState.tabOrder
    .map((tabId) => runtime.contextState.tabs[tabId])
    .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab))
    .filter((tab) => visibleDefinitionById.has(tab.definitionId))
    .map((tab) => ({
      instanceId: tab.id,
      definitionId: tab.definitionId,
      title: tab.label,
    }));

  const registeredDefinitions = new Set(registrationRefs.map((tab) => tab.definitionId));
  for (const definition of visibleDefinitions) {
    if (registeredDefinitions.has(definition.definitionId)) {
      continue;
    }

    registrationRefs.push({
      instanceId: definition.definitionId,
      definitionId: definition.definitionId,
      title: definition.title,
    });
  }

  runtime.closeableTabIds = new Set(registrationRefs.map((tab) => tab.instanceId));
  updateContextState(runtime, ensureTabsRegistered(runtime.contextState, registrationRefs));

  reconcileActiveTab(runtime);
  renderPartsView(root, runtime, {
    applySelection: (event) => bindings.applySelection(event),
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
