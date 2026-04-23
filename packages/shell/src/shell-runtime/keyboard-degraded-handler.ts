import { resolveDegradedKeyboardInteraction } from "../keyboard-a11y.js";
import type { KeybindingService } from "./keybinding-service.js";
import type { ShellRuntime } from "../app/types.js";
import type { KeyboardBindings } from "./keyboard-handlers.js";
import { handleTabLifecycleShortcut } from "./keyboard-tab-navigation.js";

/**
 * Handle keydown when bridge sync is degraded.
 * Returns true if the event was fully handled (caller should return early).
 */
export function handleDegradedKeydown(
  event: KeyboardEvent,
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
  keybindingService: KeybindingService,
  debugKeybindings: boolean,
): boolean {
  if (debugKeybindings) {
    console.debug("[shell:keybinding] degraded-mode-active");
  }

  const normalizedChord = keybindingService.normalizeEvent(event);
  if (normalizedChord && handleTabLifecycleShortcut(normalizedChord.value, event, runtime, bindings)) {
    if (debugKeybindings) {
      console.debug("[shell:keybinding] tab-lifecycle-intercepted (degraded)", { chord: normalizedChord.value });
    }
    return true;
  }

  const degradedInteraction = resolveDegradedKeyboardInteraction(event.key, runtime.activeIntentSession !== null);
  if (degradedInteraction === "dismiss-chooser") {
    event.preventDefault();
    bindings.dismissIntentChooser();
    if (debugKeybindings) {
      console.debug("[shell:keybinding] degraded-mode-blocked", { reason: "dismiss-chooser" });
    }
    return true;
  }

  if (degradedInteraction === "block") {
    event.preventDefault();
    if (debugKeybindings) {
      console.debug("[shell:keybinding] degraded-mode-blocked", { reason: "block" });
    }
  }
  return true;
}
