import {
  getTabGroupId,
  registerTab,
  setActiveTab,
  writeGlobalLane,
  writeGroupLaneByGroup,
  writeGroupLaneByTab,
} from "../context-state.js";
import {
  createRevision,
  resolveActiveTabId,
  updateContextState,
  writeGlobalSelectionLane,
  writeGroupSelectionContext,
} from "../context/runtime-state.js";
import {
  type IntentActionMatch,
  type IntentResolutionDelegate,
  type ShellIntent,
} from "../intent-runtime.js";
import {
  formatSelectionAnnouncement,
  resolveChooserFocusRestoration,
} from "../keyboard-a11y.js";
import { DEFAULT_GROUP_COLOR, DEFAULT_GROUP_ID } from "../app/constants.js";
import type { PluginActivationTriggerType } from "../plugin-registry.js";
import type { ShellRuntime } from "../app/types.js";
import type {
  ContextSyncEvent,
  SelectionSyncEvent,
} from "../window-bridge.js";
import { applySelectionPropagation } from "../domain/selection-graph.js";
import { updateDockTabVisibility } from "../ui/dock-tab-visibility.js";

export interface RuntimeEventHandlerBindings {
  activatePluginForBoundary: (options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  }) => Promise<boolean>;
  announce: (message: string) => void;
  renderContextControlsPanel: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
  summarizeSelectionPriorities: () => string;
}

export interface RuntimeEventHandlers {
  applyContext: (event: ContextSyncEvent) => void;
  applySelection: (event: SelectionSyncEvent) => void;
  executeResolvedAction: (match: IntentActionMatch, intent: ShellIntent | null) => Promise<void>;
  resolveIntentFlow: (intent: ShellIntent) => void;
}

export function createRuntimeEventHandlers(
  root: HTMLElement,
  runtime: ShellRuntime,
  bindings: RuntimeEventHandlerBindings,
): RuntimeEventHandlers {
  function applySelection(event: SelectionSyncEvent): void {
    const revision = event.revision ?? createRevision(event.sourceWindowId);
    const isRemoteSelection = event.sourceWindowId !== runtime.windowId;

    if (!isRemoteSelection) {
      runtime.selectedPartId = event.selectedPartId;
      runtime.selectedPartTitle = event.selectedPartTitle;
      updateContextState(runtime, registerTab(runtime.contextState, {
        tabId: event.selectedPartId,
        definitionId: runtime.contextState.tabs[event.selectedPartId]?.definitionId ?? event.selectedPartId,
        partDefinitionId:
          runtime.contextState.tabs[event.selectedPartId]?.partDefinitionId
          ?? runtime.contextState.tabs[event.selectedPartId]?.definitionId
          ?? event.selectedPartId,
        groupId: getTabGroupId(runtime.contextState, event.selectedPartId) ?? DEFAULT_GROUP_ID,
        groupColor: DEFAULT_GROUP_COLOR,
        tabLabel: event.selectedPartTitle,
      }));
      updateContextState(runtime, setActiveTab(runtime.contextState, event.selectedPartId));
    }
    writeGlobalSelectionLane(runtime, {
      selectedPartId: event.selectedPartId,
      selectedPartTitle: event.selectedPartTitle,
      revision,
    });

    const selectionPropagation = applySelectionPropagation(runtime, event, revision);
    updateContextState(runtime, selectionPropagation.state);

    if (selectionPropagation.derivedLaneFailures.length > 0) {
      runtime.notice = `Derived lane failures: ${selectionPropagation.derivedLaneFailures.join(", ")}`;
    }

    updateDockTabVisibility(root, runtime);
    bindings.renderSyncStatus();
    bindings.announce(formatSelectionAnnouncement({
      selectedPartTitle: runtime.selectedPartTitle,
      selectedEntitySummary: bindings.summarizeSelectionPriorities(),
    }));
  }

  function applyContext(event: ContextSyncEvent): void {
    const revision = event.revision ?? createRevision(event.sourceWindowId);
    if (event.scope === "global") {
      updateContextState(runtime, writeGlobalLane(runtime.contextState, {
        key: event.contextKey,
        value: event.contextValue,
        revision,
      }));
    } else if (event.groupId) {
      updateContextState(runtime, writeGroupLaneByGroup(runtime.contextState, {
        groupId: event.groupId,
        key: event.contextKey,
        value: event.contextValue,
        revision,
      }));
    } else {
      const targetTabId =
        event.tabId && runtime.contextState.tabs[event.tabId]
          ? event.tabId
          : (resolveActiveTabId(runtime) ?? undefined);

      if (!targetTabId) {
        return;
      }

      updateContextState(runtime, writeGroupLaneByTab(runtime.contextState, {
        tabId: targetTabId,
        key: event.contextKey,
        value: event.contextValue,
        revision,
      }));
    }
    bindings.renderContextControlsPanel();
    bindings.renderSyncStatus();
  }

  function resolveIntentFlow(intent: ShellIntent): void {
    const delegate: IntentResolutionDelegate = {
      async showChooser(matches, chooserIntent, trace) {
        return new Promise<IntentActionMatch | null>((resolve) => {
          runtime._pendingChooserResolve = resolve;
          runtime.activeIntentSession = {
            intent: chooserIntent,
            matches,
            trace,
            chooserFocusIndex: 0,
            returnFocusSelector: resolveEventTargetSelector(root),
          };
          runtime.pendingFocusSelector = "button[data-action='choose-intent-action'][data-intent-index='0']";
          runtime.intentNotice = `Choose an action for intent '${chooserIntent.type}' (${matches.length} matches).`;
          bindings.announce(`${runtime.intentNotice} Use arrow keys and Enter to choose an action.`);
          bindings.renderSyncStatus();
        });
      },
      async activatePlugin(pluginId, trigger) {
        return bindings.activatePluginForBoundary({
          pluginId,
          triggerType: trigger.type as PluginActivationTriggerType,
          triggerId: trigger.id,
        });
      },
      announce(message) {
        bindings.announce(message);
      },
    };

    void runtime.intentRuntime.resolve(intent, delegate).then((outcome) => {
      runtime.lastIntentTrace = outcome.trace;
      if (outcome.kind === "executed") {
        const match = outcome.match;
        writeGroupSelectionContext(runtime, `intent:${intent.type}`);
        const restoreSelector = resolveChooserFocusRestoration("execute", runtime.activeIntentSession?.returnFocusSelector ?? null);
        runtime.activeIntentSession = null;
        runtime._pendingChooserResolve = null;
        runtime.pendingFocusSelector = restoreSelector;
        runtime.intentNotice = `Executed '${match.title}' via ${match.pluginId}.${match.handler}.`;
        bindings.announce(runtime.intentNotice);
        updateDockTabVisibility(root, runtime);
      } else if (outcome.kind === "no-match") {
        runtime.activeIntentSession = null;
        runtime._pendingChooserResolve = null;
        runtime.intentNotice = outcome.feedback;
        bindings.announce(runtime.intentNotice);
      }
      // "cancelled" cleanup is handled by dismissIntentChooser
      bindings.renderSyncStatus();
    });
  }

  async function executeResolvedAction(
    match: IntentActionMatch,
    intent: ShellIntent | null,
  ): Promise<void> {
    const triggerId = intent?.type ?? match.intentType;
    const activated = await bindings.activatePluginForBoundary({
      pluginId: match.pluginId,
      triggerType: "intent",
      triggerId,
    });

    if (!activated) {
      runtime.intentNotice = `Intent '${triggerId}' blocked: plugin '${match.pluginId}' is not active.`;
      bindings.announce(runtime.intentNotice);
      bindings.renderSyncStatus();
      return;
    }

    const genericContextValue = intent ? `intent:${intent.type}` : "none";
    writeGroupSelectionContext(runtime, genericContextValue);

    const restoreSelector = resolveChooserFocusRestoration("execute", runtime.activeIntentSession?.returnFocusSelector ?? null);
    runtime.activeIntentSession = null;
    runtime.pendingFocusSelector = restoreSelector;
    runtime.intentNotice = `Executed '${match.title}' via ${match.pluginId}.${match.handler}.`;
    bindings.announce(runtime.intentNotice);
    updateDockTabVisibility(root, runtime);
  }

  return {
    applyContext,
    applySelection,
    executeResolvedAction,
    resolveIntentFlow,
  };
}

function resolveEventTargetSelector(root: HTMLElement): string | null {
  const active = root.ownerDocument?.activeElement;
  if (!(active instanceof HTMLElement)) {
    return null;
  }

  if (active.matches("button[data-action='activate-tab']") && active.dataset.partId) {
    return `button[data-action='activate-tab'][data-part-id='${active.dataset.partId}']`;
  }

  return null;
}
