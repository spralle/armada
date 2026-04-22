import type { ElementTransitionHook, TransitionContext } from "@ghost/plugin-contracts";
import { getCurrentConfig } from "./activate.js";

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
      el.addEventListener("animationend", function handler() {
        el.removeAttribute(DATA_MOTION_ENTER);
        el.removeEventListener("animationend", handler);
      }, { once: true });
    },

    async onExit(el: HTMLElement, _context: TransitionContext): Promise<void> {
      const config = getCurrentConfig();
      if (!config.enabled) return;

      el.setAttribute(DATA_MOTION_EXIT, "");

      return new Promise<void>((resolve) => {
        const handler = () => {
          el.removeAttribute(DATA_MOTION_EXIT);
          el.removeEventListener("animationend", handler);
          resolve();
        };
        el.addEventListener("animationend", handler, { once: true });

        // Safety timeout — don't block removal forever
        const speed = config.animations.global?.speed ?? 1;
        const timeout = Math.max(500 / speed, 100);
        setTimeout(() => {
          el.removeEventListener("animationend", handler);
          resolve();
        }, timeout);
      });
    },
  };
}
