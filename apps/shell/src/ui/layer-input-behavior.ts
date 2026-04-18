import { InputBehavior, KeyboardInteractivity } from "@ghost/plugin-contracts";

// ---------------------------------------------------------------------------
// Pointer input behavior
// ---------------------------------------------------------------------------

/**
 * Apply pointer input behavior to a layer surface element.
 *
 * - `opaque`: captures all pointer events (`pointer-events: auto`)
 * - `passthrough`: ignores all pointer events (`pointer-events: none`)
 * - `content_aware`: captures pointer events but with transparent-area awareness
 *
 * Note: Full content-aware hit-testing (detecting truly transparent pixels)
 * requires canvas compositing or `getComputedStyle` probing which is deferred.
 * For now content_aware behaves like opaque with a data attribute marker so
 * future hit-test logic can be layered on.
 */
export function applyInputBehavior(element: HTMLDivElement, inputBehavior: InputBehavior): void {
  switch (inputBehavior) {
    case InputBehavior.Opaque:
      element.style.pointerEvents = "auto";
      delete element.dataset.contentAware;
      break;
    case InputBehavior.Passthrough:
      element.style.pointerEvents = "none";
      delete element.dataset.contentAware;
      break;
    case InputBehavior.ContentAware:
      element.style.pointerEvents = "auto";
      element.dataset.contentAware = "true";
      break;
  }
}

// ---------------------------------------------------------------------------
// Keyboard interactivity
// ---------------------------------------------------------------------------

/**
 * Apply keyboard interactivity mode to a layer surface element.
 *
 * - `none`: surface cannot receive keyboard focus
 * - `on_demand`: surface participates in normal tab-order focus
 * - `exclusive`: surface auto-focuses and should be paired with
 *   `pushExclusive` from the keyboard exclusive manager
 */
export function applyKeyboardInteractivity(
  element: HTMLDivElement,
  keyboard: KeyboardInteractivity,
): void {
  switch (keyboard) {
    case KeyboardInteractivity.None:
      element.setAttribute("tabindex", "-1");
      if (document.activeElement === element) {
        element.blur();
      }
      break;
    case KeyboardInteractivity.OnDemand:
      element.setAttribute("tabindex", "0");
      break;
    case KeyboardInteractivity.Exclusive:
      element.setAttribute("tabindex", "0");
      element.focus();
      break;
  }
}

// ---------------------------------------------------------------------------
// Keyboard exclusive manager
// ---------------------------------------------------------------------------

export interface KeyboardExclusiveEntry {
  surfaceId: string;
  element: HTMLDivElement;
}

export interface KeyboardExclusiveManager {
  /** Push a surface onto the exclusive keyboard stack. Last entry wins. */
  pushExclusive(surfaceId: string, element: HTMLDivElement): void;
  /** Remove a surface from the exclusive stack. */
  popExclusive(surfaceId: string): void;
  /** Get the currently active exclusive surface, or null. */
  getActiveExclusive(): KeyboardExclusiveEntry | null;
  /** Tear down all listeners. */
  dispose(): void;
}

/**
 * Create a keyboard exclusive manager that suppresses keyboard event
 * propagation for all targets outside the active exclusive surface.
 *
 * When an exclusive surface is active, a capturing `keydown`/`keyup`
 * listener on `document` calls `stopPropagation()` and
 * `stopImmediatePropagation()` for events whose target is NOT within
 * the exclusive surface element. This prevents the shell keybinding
 * service (and any other global listeners) from receiving those events.
 */
export function createKeyboardExclusiveManager(): KeyboardExclusiveManager {
  const stack: KeyboardExclusiveEntry[] = [];
  let listenerInstalled = false;

  function handleKeyEvent(event: Event): void {
    const active = stack[stack.length - 1];
    if (!active) return;

    const target = event.target as Node | null;
    if (target && active.element.contains(target)) {
      // Event is inside the exclusive surface — allow propagation
      return;
    }

    // Suppress: prevent keybinding service and other listeners from seeing this
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function installListeners(): void {
    if (listenerInstalled) return;
    document.addEventListener("keydown", handleKeyEvent, true);
    document.addEventListener("keyup", handleKeyEvent, true);
    listenerInstalled = true;
  }

  function removeListeners(): void {
    if (!listenerInstalled) return;
    document.removeEventListener("keydown", handleKeyEvent, true);
    document.removeEventListener("keyup", handleKeyEvent, true);
    listenerInstalled = false;
  }

  return {
    pushExclusive(surfaceId: string, element: HTMLDivElement): void {
      // Remove if already present (move to top)
      const idx = stack.findIndex((e) => e.surfaceId === surfaceId);
      if (idx !== -1) stack.splice(idx, 1);
      stack.push({ surfaceId, element });
      installListeners();
      element.focus();
    },

    popExclusive(surfaceId: string): void {
      const idx = stack.findIndex((e) => e.surfaceId === surfaceId);
      if (idx !== -1) stack.splice(idx, 1);
      if (stack.length === 0) {
        removeListeners();
      } else {
        // Refocus the new top
        stack[stack.length - 1].element.focus();
      }
    },

    getActiveExclusive(): KeyboardExclusiveEntry | null {
      return stack.length > 0 ? stack[stack.length - 1] : null;
    },

    dispose(): void {
      stack.length = 0;
      removeListeners();
    },
  };
}
