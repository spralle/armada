import {
  normalizeKeyboardEvent,
  dispatchAction,
  resolveKeybindingAction,
} from "../action-surface.js";
import {
  resolveChooserFocusRestoration,
  resolveChooserKeyboardAction,
  resolveDegradedKeyboardInteraction,
} from "../keyboard-a11y.js";
import { isSelectionActionNode } from "../ui/parts-rendering.js";
import type { ShellRuntime } from "../app/types.js";
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
  renderCommandSurface: () => void;
  renderSyncStatus: () => void;
  toActionContext: () => Record<string, string>;
}

export function bindKeyboardShortcuts(
  root: HTMLElement,
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
): void {
  root.addEventListener("keydown", async (event) => {
    if (handleChooserKeyboardEvent(runtime, event, bindings)) {
      return;
    }

    if (runtime.syncDegraded) {
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

    const normalizedKey = normalizeKeyboardEvent(event);
    if (normalizedKey) {
      const context = bindings.toActionContext();
      const action = resolveKeybindingAction(runtime.actionSurface, normalizedKey, context);
      if (action) {
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
        const executed = await dispatchAction(runtime.actionSurface, runtime.intentRuntime, action.id, context);
        runtime.commandNotice = executed
          ? `Keybinding (${normalizedKey}): Action '${action.id}' executed.`
          : `Keybinding (${normalizedKey}): Action '${action.id}' is not executable in current context.`;
        bindings.renderCommandSurface();
        return;
      }
    }

    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && isSelectionActionNode(target)) {
      const selector = `[data-action='${target.dataset.action ?? ""}']`;
      const nodes = [...root.querySelectorAll<HTMLElement>(selector)];
      const index = nodes.indexOf(target);
      if (index < 0 || nodes.length <= 1) {
        return;
      }

      const nextIndex = event.key === "ArrowDown"
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
  });
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
