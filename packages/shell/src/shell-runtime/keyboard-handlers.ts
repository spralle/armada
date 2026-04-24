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
import type { BridgeHost, ShellRuntime } from "../app/types.js";
import type { IntentActionMatch, ShellIntent } from "@ghost-shell/intents";
import type { PluginActivationTriggerType } from "../plugin-registry.js";
import type { NormalizedKeybindingChord } from "./keybinding-normalizer.js";
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
  applySelection: (event: import("@ghost-shell/bridge").SelectionSyncEvent) => void;
  publishWithDegrade: (event: Parameters<BridgeHost["bridge"]["publish"]>[0]) => void;
  renderContextControls: () => void;
  renderEdgeSlots: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
  toActionContext: () => Record<string, string>;
  getDefaultKeybindings: () => ActionKeybinding[];
  getUserOverrideKeybindings: () => ActionKeybinding[];
  getWorkspaceSwitchDeps: () => WorkspaceSwitchDeps;
}

const DEBUG_KEYBINDINGS =
  typeof localStorage !== "undefined" &&
  localStorage.getItem("ghost.debug.keybindings") === "true";

const SEQUENCE_TIMEOUT_KEY = "ghost.keybindings.sequenceTimeoutMs";
const SEQUENCE_TIMEOUT_DEFAULT = 1000;
const SEQUENCE_TIMEOUT_MIN = 200;
const SEQUENCE_TIMEOUT_MAX = 5000;

/**
 * Read sequence timeout from localStorage with validation and clamping.
 * Returns default (1000ms) if value is missing, non-numeric, or out of range.
 */
function readSequenceTimeoutMs(): number {
  if (typeof localStorage === "undefined") return SEQUENCE_TIMEOUT_DEFAULT;
  const raw = localStorage.getItem(SEQUENCE_TIMEOUT_KEY);
  if (raw == null) return SEQUENCE_TIMEOUT_DEFAULT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return SEQUENCE_TIMEOUT_DEFAULT;
  return Math.max(SEQUENCE_TIMEOUT_MIN, Math.min(SEQUENCE_TIMEOUT_MAX, Math.round(parsed)));
}

function computeOverrideFingerprint(overrides: ActionKeybinding[]): string {
  if (overrides.length === 0) return "";
  return overrides.map((o) => `${o.action}:${o.keybinding}`).join("|");
}

interface ChordSequenceState {
  /** Chords accumulated so far */
  pressedChords: NormalizedKeybindingChord[];
  /** Timer handle for timeout cancellation */
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  /** Timestamp of first chord for debugging */
  startedAt: number;
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
      sequenceTimeoutMs: readSequenceTimeoutMs(),
    });
    return cachedService;
  }

  let sequenceState: ChordSequenceState | null = null;

  function clearSequenceState(): void {
    if (sequenceState?.timeoutHandle != null) {
      clearTimeout(sequenceState.timeoutHandle);
    }
    sequenceState = null;
  }

  function startSequenceTimeout(): void {
    if (sequenceState?.timeoutHandle != null) {
      clearTimeout(sequenceState.timeoutHandle);
    }
    if (sequenceState) {
      const timeoutChords = sequenceState.pressedChords.map(c => c.value);
      sequenceState.timeoutHandle = setTimeout(() => {
        if (DEBUG_KEYBINDINGS) {
          console.debug("[shell:keybinding] sequence-timeout", {
            chords: timeoutChords,
          });
        }
        clearSequenceState();
        getKeybindingService().fireKeySequenceCancelled({ chords: timeoutChords, reason: "timeout" });
        bindings.renderSyncStatus();
      }, getKeybindingService().sequenceTimeoutMs);
    }
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

    // Escape cancels any pending chord sequence immediately
    if (sequenceState && event.key === "Escape") {
      event.preventDefault();
      const cancelledChords = sequenceState.pressedChords.map(c => c.value);
      clearSequenceState();
      keybindingService.fireKeySequenceCancelled({ chords: cancelledChords, reason: "escape" });
      bindings.renderSyncStatus();
      if (DEBUG_KEYBINDINGS) {
        console.debug("[shell:keybinding] sequence-cancelled-escape", { chords: cancelledChords });
      }
      return;
    }

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

      const degradedInteraction = resolveDegradedKeyboardInteraction(event.key, runtime.activeIntentSession !== null);
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

    if (normalizedChord) {
      // Tab lifecycle shortcuts only when no sequence is pending
      if (!sequenceState && handleTabLifecycleShortcut(normalizedChord.value, event, runtime, bindings)) {
        if (DEBUG_KEYBINDINGS) {
          console.debug("[shell:keybinding] tab-lifecycle-intercepted", { chord: normalizedChord.value });
        }
        return;
      }

      // Build the chord list: existing pending chords + this new chord
      const chords = sequenceState
        ? [...sequenceState.pressedChords, normalizedChord]
        : [normalizedChord];

      const context = bindings.toActionContext();
      const resolution = keybindingService.resolveSequence(chords, context);

      if (DEBUG_KEYBINDINGS) {
        console.debug("[shell:keybinding] sequence-resolve", {
          chords: chords.map(c => c.value),
          kind: resolution.kind,
          actionId: resolution.match?.action.id ?? null,
          prefixCount: resolution.prefixCount ?? 0,
        });
      }

      if (resolution.kind === "exact") {
        clearSequenceState();
        event.preventDefault();

        const action = resolution.match!.action;
        const activated = await bindings.activatePluginForBoundary({
          pluginId: action.pluginId,
          triggerType: "command",
          triggerId: action.id,
        });
        if (!activated) {
          runtime.commandNotice = `Action '${action.id}' blocked: plugin '${action.pluginId}' is not active.`;
          return;
        }

        const shellResult = handleShellKeyboardAction(runtime, bindings, action.id);
        let executed = shellResult.executed;
        if (!shellResult.handled) {
          const runtimeHandler = runtime.runtimeActionRegistry.get(action.id);
          if (runtimeHandler) {
            try {
              const runtimeResult = await runtimeHandler();
              executed = runtimeResult === false ? false : true;
            } catch (runtimeError) {
              console.warn("[shell:keybinding] runtime action failed", action.id, runtimeError);
              executed = false;
            }
          } else {
            const result = await keybindingService.dispatchSequence(chords, context);
            executed = result.executed;
          }
        }

        const chordStr = chords.map(c => c.value).join(" ");
        runtime.commandNotice = shellResult.handled
          ? `Keybinding (${chordStr}): ${shellResult.message}`
          : executed
            ? `Keybinding (${chordStr}): Action '${action.id}' executed.`
            : `Keybinding (${chordStr}): Action '${action.id}' is not executable in current context.`;

        if (chords.length > 1) {
          keybindingService.fireKeySequenceCompleted({ chords: chords.map(c => c.value), actionId: action.id });
        }

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
          bindings.renderContextControls();
          bindings.renderEdgeSlots();
          bindings.renderParts();
          bindings.renderSyncStatus();
        }
        return;
      }

      if (resolution.kind === "prefix") {
        event.preventDefault();
        sequenceState = {
          pressedChords: chords,
          timeoutHandle: null,
          startedAt: sequenceState?.startedAt ?? Date.now(),
        };
        startSequenceTimeout();

        keybindingService.fireKeySequencePending({
          pressedChords: chords.map(c => c.value),
          candidateCount: resolution.prefixCount ?? 0,
        });
        bindings.renderSyncStatus();

        if (DEBUG_KEYBINDINGS) {
          console.debug("[shell:keybinding] sequence-pending", {
            chords: chords.map(c => c.value),
            prefixCount: resolution.prefixCount,
          });
        }
        return;
      }

      // kind === "none" — no match
      if (sequenceState) {
        if (DEBUG_KEYBINDINGS) {
          console.debug("[shell:keybinding] sequence-broken", {
            chords: chords.map(c => c.value),
          });
        }
        const cancelledChords = sequenceState.pressedChords.map(c => c.value);
        clearSequenceState();
        keybindingService.fireKeySequenceCancelled({ chords: cancelledChords, reason: "no_match" });
        bindings.renderSyncStatus();
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
    return () => {
      clearSequenceState();
      document.removeEventListener("keydown", onKeyDown);
    };
  }
  root.addEventListener("keydown", onKeyDown);
  return () => {
    clearSequenceState();
    root.removeEventListener("keydown", onKeyDown);
  };
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
  const restoreSelector = resolveChooserFocusRestoration("dismiss", runtime.activeIntentSession?.returnFocusSelector ?? null);
  if (runtime._pendingChooserResolve) {
    runtime._pendingChooserResolve(null);
    runtime._pendingChooserResolve = null;
  }
  runtime.activeIntentSession = null;
  runtime.intentNotice = "Action chooser dismissed.";
  runtime.pendingFocusSelector = restoreSelector;
  bindings.announce(runtime.intentNotice);
  bindings.renderSyncStatus();
}

function handleChooserKeyboardEvent(
  runtime: ShellRuntime,
  event: KeyboardEvent,
  bindings: KeyboardBindings,
): boolean {
  if (!runtime.activeIntentSession) {
    return false;
  }

  const result = resolveChooserKeyboardAction(
    event.key,
    runtime.activeIntentSession.chooserFocusIndex,
    runtime.activeIntentSession.matches.length,
  );

  if (result.kind === "none") {
    return false;
  }

  event.preventDefault();
  if (result.kind === "focus") {
    runtime.activeIntentSession.chooserFocusIndex = result.index;
    runtime.pendingFocusSelector = `button[data-action='choose-intent-action'][data-intent-index='${result.index}']`;
    bindings.renderSyncStatus();
    return true;
  }

  if (result.kind === "execute") {
    runtime.activeIntentSession.chooserFocusIndex = result.index;
    const selected = runtime.activeIntentSession.matches[result.index];
    if (selected) {
      if (runtime._pendingChooserResolve) {
        runtime._pendingChooserResolve(selected);
      } else {
        void bindings.executeResolvedAction(selected, runtime.activeIntentSession.intent);
      }
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
