import {
  resolveChooserFocusRestoration,
  resolveChooserKeyboardAction,
} from "../keyboard-a11y.js";
import type { ShellRuntime } from "../app/types.js";
import type { KeyboardBindings } from "./keyboard-handlers.js";

export function handleChooserKeyboardEvent(
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
