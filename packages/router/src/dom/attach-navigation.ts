import type { NavigationHints, NavigationTarget } from "../core/types.js";
import type { NavigationAttachment, NavigationModifierMap } from "./link-types.js";
import type { CreateNavigationHandlerOptions } from "./navigation-handler.js";
import { createNavigationHandler } from "./navigation-handler.js";

/**
 * Options for {@link attachNavigation}.
 */
export interface AttachNavigationOptions {
  /** The navigation target to open when the element is activated. */
  readonly target: NavigationTarget;
  /** Callback invoked to perform the actual navigation. */
  readonly onNavigate: (target: NavigationTarget, hints: NavigationHints) => void;
  /** Custom modifier-to-placement mapping. */
  readonly modifiers?: NavigationModifierMap | undefined;
  /** Default navigation hints. */
  readonly defaultHints?: NavigationHints | undefined;
}

/**
 * Attaches navigation behavior to a single DOM element, handling click,
 * middle-click (auxclick), and keyboard activation (Enter on links).
 *
 * @example
 * ```ts
 * const attachment = attachNavigation(linkElement, {
 *   target: { route: "vessel.detail", params: { vesselId: "v123" } },
 *   onNavigate: (target, hints) => router.navigate(target, hints),
 * });
 *
 * // Clean up when no longer needed:
 * attachment.dispose();
 * ```
 *
 * @param element - The DOM element to attach navigation to.
 * @param options - Navigation configuration.
 * @returns A {@link NavigationAttachment} with a `dispose()` method.
 */
export function attachNavigation(element: HTMLElement, options: AttachNavigationOptions): NavigationAttachment {
  const handlerOptions: CreateNavigationHandlerOptions = {
    target: options.target,
    defaultHints: options.defaultHints,
    modifiers: options.modifiers,
    onNavigate: options.onNavigate,
  };

  const clickHandler = createNavigationHandler(handlerOptions);

  const keydownHandler = (event: KeyboardEvent): void => {
    if (event.key !== "Enter") return;

    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    if (tag !== "a" && role !== "link") return;

    event.preventDefault();
    // Synthesize a click-like dispatch using the keyboard event modifiers
    options.onNavigate(options.target, {
      ...options.defaultHints,
      history: options.defaultHints?.history ?? "push",
    });
  };

  element.addEventListener("click", clickHandler);
  element.addEventListener("auxclick", clickHandler);
  element.addEventListener("keydown", keydownHandler);

  return {
    dispose(): void {
      element.removeEventListener("click", clickHandler);
      element.removeEventListener("auxclick", clickHandler);
      element.removeEventListener("keydown", keydownHandler);
    },
  };
}
