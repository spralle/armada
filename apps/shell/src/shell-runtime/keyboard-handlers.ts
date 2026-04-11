import {
  resolveChooserFocusRestoration,
  resolveChooserKeyboardAction,
  resolveDegradedKeyboardInteraction,
  resolveTabLifecycleShortcut,
} from "../keyboard-a11y.js";
import {
  createKeybindingService,
} from "./keybinding-service.js";
import {
  closeTabThroughRuntime,
  reopenMostRecentlyClosedTabThroughRuntime,
} from "../ui/parts-controller.js";
import type { ShellRuntime } from "../app/types.js";
import type { ActionKeybinding } from "../action-surface.js";
import type { IntentActionMatch, ShellIntent } from "../intent-runtime.js";
import type { PluginActivationTriggerType } from "../plugin-registry.js";

export interface KeyboardBindings {
  activatePluginForBoundary: (options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  }) => Promise<boolean>;
  announce: (message: string) => void;
  dismissIntentChooser: () => void;
  executeResolvedAction: (match: IntentActionMatch, intent: ShellIntent | null) => Promise<void>;
  applySelection: (event: import("../window-bridge.js").SelectionSyncEvent) => void;
  publishWithDegrade: (event: Parameters<ShellRuntime["bridge"]["publish"]>[0]) => void;
  renderContextControls: () => void;
  renderParts: () => void;
  renderCommandSurface: () => void;
  renderSyncStatus: () => void;
  toActionContext: () => Record<string, string>;
  getDefaultKeybindings: () => ActionKeybinding[];
  getUserOverrideKeybindings: () => ActionKeybinding[];
}

export function bindKeyboardShortcuts(
  root: HTMLElement,
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
): () => void {
  const onKeyDown = async (event: KeyboardEvent) => {
    if (handleChooserKeyboardEvent(runtime, event, bindings)) {
      return;
    }

    const keybindingService = createRuntimeKeybindingService(runtime, bindings);

    if (runtime.syncDegraded) {
      const normalizedChord = keybindingService.normalizeEvent(event);
      if (normalizedChord && handleTabLifecycleShortcut(normalizedChord.value, event, runtime, bindings)) {
        return;
      }

      const degradedInteraction = resolveDegradedKeyboardInteraction(event.key, runtime.pendingIntentMatches.length > 0);
      if (degradedInteraction === "dismiss-chooser") {
        event.preventDefault();
        bindings.dismissIntentChooser();
        return;
      }

      if (degradedInteraction === "block") {
        event.preventDefault();
      }
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const normalizedChord = keybindingService.normalizeEvent(event);
    if (normalizedChord && handleTabLifecycleShortcut(normalizedChord.value, event, runtime, bindings)) {
      return;
    }

    if (normalizedChord) {
      const context = bindings.toActionContext();
      const resolution = keybindingService.resolve(normalizedChord, context);
      if (resolution.match) {
        const action = resolution.match.action;
        const activated = await bindings.activatePluginForBoundary({
          pluginId: action.pluginId,
          triggerType: "command",
          triggerId: action.id,
        });
        if (!activated) {
          runtime.commandNotice = `Action '${action.id}' blocked: plugin '${action.pluginId}' is not active.`;
          bindings.renderCommandSurface();
          return;
        }

        event.preventDefault();
        const result = await keybindingService.dispatch(normalizedChord, context);
        runtime.commandNotice = result.executed
          ? `Keybinding (${normalizedChord.value}): Action '${action.id}' executed.`
          : `Keybinding (${normalizedChord.value}): Action '${action.id}' is not executable in current context.`;
        bindings.renderCommandSurface();
        return;
      }
    }

    if (
      (event.key === "ArrowDown"
        || event.key === "ArrowUp"
        || event.key === "ArrowLeft"
        || event.key === "ArrowRight")
      && isTabScopeNavigationNode(target)
    ) {
      const tabScope = target.dataset.tabScope;
      const nodes = tabScope
        ? [...root.querySelectorAll<HTMLButtonElement>(`button[data-tab-scope='${tabScope}'][data-action]`)]
          .filter(isTabScopeNavigationNode)
          .filter((node) => !node.disabled)
        : [];
      const index = nodes.indexOf(target);
      if (index < 0 || nodes.length <= 1) {
        return;
      }

      const isForward = event.key === "ArrowDown" || event.key === "ArrowRight";
      const nextIndex = isForward
        ? (index + 1) % nodes.length
        : (index - 1 + nodes.length) % nodes.length;
      nodes[nextIndex]?.focus();
      event.preventDefault();
      return;
    }

    if (event.key === "Enter" && target.id === "context-value-input") {
      const apply = root.querySelector<HTMLButtonElement>("#context-apply");
      apply?.click();
      event.preventDefault();
    }
  };

  root.addEventListener("keydown", onKeyDown);

  return () => {
    root.removeEventListener("keydown", onKeyDown);
  };
}

function createRuntimeKeybindingService(
  runtime: ShellRuntime,
  bindings: Pick<KeyboardBindings, "getDefaultKeybindings" | "getUserOverrideKeybindings">,
) {
  return createKeybindingService({
    actionSurface: runtime.actionSurface,
    intentRuntime: runtime.intentRuntime,
    defaultBindings: bindings.getDefaultKeybindings(),
    pluginBindings: runtime.actionSurface.keybindings,
    userOverrideBindings: bindings.getUserOverrideKeybindings(),
  });
}

function handleTabLifecycleShortcut(
  normalizedKey: string,
  event: KeyboardEvent,
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
): boolean {
  const lifecycleShortcut = resolveTabLifecycleShortcut(normalizedKey);
  if (lifecycleShortcut === "reopen-closed-tab") {
    event.preventDefault();
    reopenMostRecentlyClosedTabThroughRuntime(runtime, {
      applySelection: bindings.applySelection,
      publishWithDegrade: bindings.publishWithDegrade,
      renderContextControls: bindings.renderContextControls,
      renderParts: bindings.renderParts,
      renderSyncStatus: bindings.renderSyncStatus,
    });
    return true;
  }

  if (lifecycleShortcut === "close-active-tab") {
    const activeTabId = runtime.selectedPartId && runtime.contextState.tabs[runtime.selectedPartId]
      ? runtime.selectedPartId
      : runtime.contextState.activeTabId;
    if (activeTabId) {
      event.preventDefault();
      closeTabThroughRuntime(runtime, activeTabId, {
        applySelection: bindings.applySelection,
        publishWithDegrade: bindings.publishWithDegrade,
        renderContextControls: bindings.renderContextControls,
        renderParts: bindings.renderParts,
        renderSyncStatus: bindings.renderSyncStatus,
      });
    }
    return true;
  }

  return false;
}

export function dismissIntentChooser(
  runtime: ShellRuntime,
  bindings: Pick<KeyboardBindings, "announce" | "renderSyncStatus">,
): void {
  runtime.pendingIntentMatches = [];
  runtime.pendingIntent = null;
  runtime.chooserFocusIndex = 0;
  runtime.intentNotice = "Action chooser dismissed.";
  const restoreSelector = resolveChooserFocusRestoration("dismiss", runtime.chooserReturnFocusSelector);
  runtime.chooserReturnFocusSelector = null;
  runtime.pendingFocusSelector = restoreSelector;
  bindings.announce(runtime.intentNotice);
  bindings.renderSyncStatus();
}

function handleChooserKeyboardEvent(
  runtime: ShellRuntime,
  event: KeyboardEvent,
  bindings: KeyboardBindings,
): boolean {
  if (!runtime.pendingIntentMatches.length) {
    return false;
  }

  const result = resolveChooserKeyboardAction(
    event.key,
    runtime.chooserFocusIndex,
    runtime.pendingIntentMatches.length,
  );

  if (result.kind === "none") {
    return false;
  }

  event.preventDefault();
  if (result.kind === "focus") {
    runtime.chooserFocusIndex = result.index;
    runtime.pendingFocusSelector = `button[data-action='choose-intent-action'][data-intent-index='${result.index}']`;
    bindings.renderSyncStatus();
    return true;
  }

  if (result.kind === "execute") {
    runtime.chooserFocusIndex = result.index;
    const selected = runtime.pendingIntentMatches[result.index];
    if (selected) {
      void bindings.executeResolvedAction(selected, runtime.pendingIntent);
    }
    return true;
  }

  bindings.dismissIntentChooser();
  return true;
}

const TAB_SCOPE_NAVIGATION_ACTIONS = new Set([
  "activate-tab",
  "close-tab",
  "reopen-closed-tab",
]);

function isTabScopeNavigationNode(target: HTMLElement): target is HTMLButtonElement {
  const tabScope = target.dataset.tabScope;
  const action = target.dataset.action;
  const isKnownAction = typeof action === "string" && TAB_SCOPE_NAVIGATION_ACTIONS.has(action);
  return target instanceof HTMLButtonElement
    && Boolean(tabScope)
    && isKnownAction;
}
