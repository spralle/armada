import type { ElementTransitionHook, TransitionContext } from "@ghost-shell/contracts/services";
import { getCurrentConfig } from "./activate.js";
import { resolveEntry } from "./config-resolver.js";

const DATA_MOTION_ENTER = "data-motion-enter";
const DATA_MOTION_EXIT = "data-motion-exit";

/**
 * Creates an ElementTransitionHook that applies motion data attributes
 * for surface enter/exit transitions.
 */
export function createMotionTransitionHook(): ElementTransitionHook {
  return {
    onEnter(el: HTMLElement, _context: TransitionContext): void {
      const config = getCurrentConfig();
      if (!config.enabled) return;

      el.setAttribute(DATA_MOTION_ENTER, "");
      el.addEventListener(
        "animationend",
        () => {
          el.removeAttribute(DATA_MOTION_ENTER);
        },
        { once: true },
      );

      // Safety cleanup — remove stale attribute if animation never fires
      const resolved = resolveEntry("layers", config);
      const cleanupMs = resolved.speed * 100 * 2;
      setTimeout(
        () => {
          el.removeAttribute(DATA_MOTION_ENTER);
        },
        Math.max(cleanupMs, 200),
      );
    },

    async onExit(el: HTMLElement, _context: TransitionContext): Promise<void> {
      const config = getCurrentConfig();
      if (!config.enabled) return;

      el.setAttribute(DATA_MOTION_EXIT, "");

      const resolved = resolveEntry("layers", config);
      const durationMs = resolved.speed * 100;

      return new Promise<void>((resolve) => {
        el.addEventListener(
          "animationend",
          () => {
            el.removeAttribute(DATA_MOTION_EXIT);
            resolve();
          },
          { once: true },
        );

        setTimeout(
          () => {
            el.removeAttribute(DATA_MOTION_EXIT);
            resolve();
          },
          Math.max(durationMs * 2, 200),
        );
      });
    },
  };
}
