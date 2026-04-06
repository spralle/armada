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
  updateContextState,
  writeGlobalSelectionLane,
  writeGroupSelectionContext,
} from "../context/runtime-state.js";
import {
  createActionCatalogFromRegistrySnapshot,
  resolveIntentWithTrace,
  type IntentActionMatch,
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
import { updateSelectedStyles } from "../ui/parts-rendering.js";

export interface RuntimeEventHandlerBindings {
  activatePluginForBoundary: (options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  }) => Promise<boolean>;
  announce: (message: string) => void;
  renderCommandSurface: () => void;
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
    runtime.selectedPartId = event.selectedPartId;
    runtime.selectedPartTitle = event.selectedPartTitle;
    updateContextState(runtime, registerTab(runtime.contextState, {
      tabId: event.selectedPartId,
      groupId: getTabGroupId(runtime.contextState, event.selectedPartId) ?? DEFAULT_GROUP_ID,
      groupColor: DEFAULT_GROUP_COLOR,
      tabLabel: event.selectedPartTitle,
    }));
    updateContextState(runtime, setActiveTab(runtime.contextState, event.selectedPartId));
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

    bindings.renderParts();
    updateSelectedStyles(root, runtime.selectedPartId);
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
    } else if (event.tabId) {
      updateContextState(runtime, writeGroupLaneByTab(runtime.contextState, {
        tabId: event.tabId,
        key: event.contextKey,
        value: event.contextValue,
        revision,
      }));
    }
    bindings.renderContextControlsPanel();
    bindings.renderSyncStatus();
    bindings.renderCommandSurface();
  }

  function resolveIntentFlow(intent: ShellIntent): void {
    const catalog = createActionCatalogFromRegistrySnapshot(runtime.registry.getSnapshot());
    const resolved = resolveIntentWithTrace(catalog, intent);
    const resolution = resolved.resolution;
    runtime.pendingIntent = intent;
    runtime.lastIntentTrace = resolved.trace;

    if (resolution.kind === "no-match") {
      runtime.pendingIntentMatches = [];
      runtime.chooserFocusIndex = 0;
      runtime.intentNotice = resolution.feedback;
      bindings.announce(runtime.intentNotice);
      return;
    }

    if (resolution.kind === "single-match") {
      runtime.pendingIntentMatches = [];
      runtime.chooserFocusIndex = 0;
      bindings.announce(resolution.feedback);
      void executeResolvedAction(resolution.matches[0], intent);
      return;
    }

    runtime.pendingIntentMatches = resolution.matches;
    runtime.chooserFocusIndex = 0;
    runtime.chooserReturnFocusSelector = resolveEventTargetSelector(root);
    runtime.pendingFocusSelector = "button[data-action='choose-intent-action'][data-intent-index='0']";
    runtime.intentNotice = resolution.feedback;
    bindings.announce(`${resolution.feedback} Use arrow keys and Enter to choose an action.`);
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

    runtime.pendingIntentMatches = [];
    runtime.chooserFocusIndex = 0;
    const restoreSelector = resolveChooserFocusRestoration("execute", runtime.chooserReturnFocusSelector);
    runtime.chooserReturnFocusSelector = null;
    runtime.pendingFocusSelector = restoreSelector;
    runtime.intentNotice = `Executed '${match.title}' via ${match.pluginId}.${match.handler}.`;
    bindings.announce(runtime.intentNotice);
    bindings.renderParts();
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
