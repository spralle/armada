import {
  resolveChooserFocusRestoration,
  resolveChooserKeyboardAction,
  resolveDegradedKeyboardInteraction,
  resolveTabLifecycleShortcut,
} from "../keyboard-a11y.js";
import { createKeybindingService, type KeybindingService } from "./keybinding-service.js";
import type { ActionKeybinding, ActionSurface } from "../action-surface.js";
import { DEFAULT_SHELL_KEYBINDING_PLUGIN_ID } from "./default-shell-keybindings.js";
import {
  closeTabThroughRuntime,
  reopenMostRecentlyClosedTabThroughRuntime,
} from "../ui/parts-controller.js";
import { handleShellKeyboardAction } from "./shell-keyboard-actions.js";
import type { ShellRuntime } from "../app/types.js";
import type { IntentActionMatch, ShellIntent } from "../intent-runtime.js";
import type { PluginActivationTriggerType } from "../plugin-registry.js";
import { updateDockTabVisibility, needsStructuralRender } from "../ui/dock-tab-visibility.js";
import type { WorkspaceSwitchDeps } from "../ui/workspace-switch.js";

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
  renderEdgeSlots: () => void;
  renderParts: () => void;
  renderCommandSurface: () => void;
  renderSyncStatus: () => void;
  toActionContext: () => Record<string, string>;
  getDefaultKeybindings: () => ActionKeybinding[];
  getUserOverrideKeybindings: () => ActionKeybinding[];
  getWorkspaceSwitchDeps: () => WorkspaceSwitchDeps;
}

const DEBUG_KEYBINDINGS =
  typeof localStorage !== "undefined" &&
  localStorage.getItem("ghost.debug.keybindings") === "true";

function computeOverrideFingerprint(overrides: ActionKeybinding[]): string {
  if (overrides.length === 0) return "";
  return overrides.map((o) => `${o.action}:${o.keybinding}`).join("|");
}

export function bindKeyboardShortcuts(
  root: HTMLElement,
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
): () => void {
  let cachedService: KeybindingService | null = null;
  let cachedActionSurface: ActionSurface | null = null;
  let cachedOverrideFingerprint = "";

  function getKeybindingService(): KeybindingService {
    const overrides = bindings.getUserOverrideKeybindings();
    const fingerprint = computeOverrideFingerprint(overrides);
    if (
      cachedService &&
      cachedActionSurface === runtime.actionSurface &&
      cachedOverrideFingerprint === fingerprint
    ) {
      return cachedService;
    }
    cachedActionSurface = runtime.actionSurface;
    cachedOverrideFingerprint = fingerprint;
    cachedService = createKeybindingService({
      actionSurface: runtime.actionSurface,
      intentRuntime: runtime.intentRuntime,
      defaultBindings: bindings.getDefaultKeybindings(),
      pluginBindings: runtime.actionSurface.keybindings.filter(
        (b) => b.pluginId !== DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
      ),
      userOverrideBindings: overrides,
    });
    return cachedService;
  }

  const onKeyDown = async (event: KeyboardEvent) => {
    if (DEBUG_KEYBINDINGS) {
      const targetEl = event.target;
      const tagName = targetEl instanceof Element ? targetEl.tagName : String(targetEl);
      console.debug("[shell:keybinding] event-received", {
        key: event.key,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
        target: tagName,
      });
    }

    if (handleChooserKeyboardEvent(runtime, event, bindings)) {
      if (DEBUG_KEYBINDINGS) {
        console.debug("[shell:keybinding] chooser-intercepted");
      }
      return;
    }

    const keybindingService = getKeybindingService();

    if (runtime.syncDegraded) {
      if (DEBUG_KEYBINDINGS) {
        console.debug("[shell:keybinding] degraded-mode-active");
      }
      const normalizedChord = keybindingService.normalizeEvent(event);
      if (normalizedChord && handleTabLifecycleShortcut(normalizedChord.value, event, runtime, bindings)) {
        if (DEBUG_KEYBINDINGS) {
          console.debug("[shell:keybinding] tab-lifecycle-intercepted (degraded)", { chord: normalizedChord.value });
        }
        return;
      }

      const degradedInteraction = resolveDegradedKeyboardInteraction(event.key, runtime.pendingIntentMatches.length > 0);
      if (degradedInteraction === "dismiss-chooser") {
        event.preventDefault();
        bindings.dismissIntentChooser();
        if (DEBUG_KEYBINDINGS) {
          console.debug("[shell:keybinding] degraded-mode-blocked", { reason: "dismiss-chooser" });
        }
        return;
      }

      if (degradedInteraction === "block") {
        event.preventDefault();
        if (DEBUG_KEYBINDINGS) {
          console.debug("[shell:keybinding] degraded-mode-blocked", { reason: "block" });
        }
      }
      return;
    }

    const normalizedChord = keybindingService.normalizeEvent(event);
    if (DEBUG_KEYBINDINGS) {
      console.debug("[shell:keybinding] normalized-chord", {
        chord: normalizedChord?.value ?? null,
      });
    }

    if (normalizedChord && handleTabLifecycleShortcut(normalizedChord.value, event, runtime, bindings)) {
      if (DEBUG_KEYBINDINGS) {
        console.debug("[shell:keybinding] tab-lifecycle-intercepted", { chord: normalizedChord.value });
      }
      return;
    }

    if (normalizedChord) {
      const context = bindings.toActionContext();
      const resolution = keybindingService.resolve(normalizedChord, context);
      if (DEBUG_KEYBINDINGS) {
        console.debug("[shell:keybinding] resolve-result", {
          chord: normalizedChord.value,
          matched: resolution.match !== null,
          actionId: resolution.match?.action.id ?? null,
          pluginId: resolution.match?.action.pluginId ?? null,
        });
      }

      if (resolution.match) {
        const action = resolution.match.action;
        const activated = await bindings.activatePluginForBoundary({
          pluginId: action.pluginId,
          triggerType: "command",
          triggerId: action.id,
        });
        if (DEBUG_KEYBINDINGS) {
          console.debug("[shell:keybinding] activation-gate", {
            pluginId: action.pluginId,
            actionId: action.id,
            pass: activated,
          });
        }
        if (!activated) {
          runtime.commandNotice = `Action '${action.id}' blocked: plugin '${action.pluginId}' is not active.`;
          bindings.renderCommandSurface();
          return;
        }

        const shellResult = handleShellKeyboardAction(runtime, bindings, action.id);
        let executed = shellResult.executed;
        if (!shellResult.handled) {
          event.preventDefault();
          const runtimeHandler = runtime.runtimeActionRegistry.get(action.id);
          if (runtimeHandler) {
            try {
              await runtimeHandler();
              executed = true;
            } catch (runtimeError) {
              console.warn("[shell:keybinding] runtime action failed", action.id, runtimeError);
              executed = false;
            }
          } else {
            const result = await keybindingService.dispatch(normalizedChord, context);
            executed = result.executed;
          }
          if (DEBUG_KEYBINDINGS) {
            console.debug("[shell:keybinding] non-shell-dispatch", {
              actionId: action.id,
              executed,
              source: runtimeHandler ? "runtime-registry" : "intent-dispatch",
            });
          }
        } else if (shellResult.executed) {
          event.preventDefault();
        }
        if (DEBUG_KEYBINDINGS) {
          console.debug("[shell:keybinding] shell-action-dispatch", {
            handled: shellResult.handled,
            executed: shellResult.executed,
            message: shellResult.message,
          });
        }
        runtime.commandNotice = shellResult.handled
          ? `Keybinding (${normalizedChord.value}): ${shellResult.message}`
          : executed
            ? `Keybinding (${normalizedChord.value}): Action '${action.id}' executed.`
            : `Keybinding (${normalizedChord.value}): Action '${action.id}' is not executable in current context.`;
        if (shellResult.handled) {
          bindings.renderContextControls();
          bindings.renderEdgeSlots();
          if (shellResult.executed && needsStructuralRender(action.id)) {
            bindings.renderParts();
          } else if (shellResult.executed) {
            updateDockTabVisibility(root, runtime);
          }
          bindings.renderSyncStatus();
        } else if (executed) {
          // Plugin-registered actions may mutate context state (e.g., openView).
          // Trigger a full structural re-render so new tabs/views appear.
          bindings.renderContextControls();
          bindings.renderParts();
          bindings.renderSyncStatus();
        }
        bindings.renderCommandSurface();
        return;
      }
    }

    const target = event.target;
    if (target instanceof HTMLElement) {
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
    } else if (DEBUG_KEYBINDINGS) {
      console.debug("[shell:keybinding] target-guard-rejection", {
        targetType: typeof target,
        constructor: target?.constructor?.name ?? "unknown",
      });
    }
  };

  // Attach to document so keybindings work regardless of focus location.
  // Falls back to root in non-browser environments (Node.js tests).
  if (typeof document !== "undefined") {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }
  root.addEventListener("keydown", onKeyDown);
  return () => root.removeEventListener("keydown", onKeyDown);
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
