import type { FocusGrabConfig } from "@ghost/plugin-contracts";
import type { KeyboardExclusiveManager } from "./layer-input-behavior.js";

// ---------------------------------------------------------------------------
// Focus grab manager
// ---------------------------------------------------------------------------

const DEFAULT_BACKDROP_COLOR = "rgba(0,0,0,0.4)";

export interface FocusGrabOptions {
  surfaceId: string;
  surfaceElement: HTMLDivElement;
  layerContainer: HTMLElement;
  config: FocusGrabConfig;
  onDismiss?: () => void;
}

interface GrabEntry {
  surfaceId: string;
  backdrop: HTMLDivElement | null;
  clickHandler: (() => void) | null;
}

export interface FocusGrabManager {
  grabFocus(options: FocusGrabOptions): void;
  releaseFocus(surfaceId: string): void;
  getActiveGrab(): GrabEntry | null;
}

/**
 * Create a focus grab manager that inserts optional backdrop elements
 * behind grabbed surfaces and delegates keyboard exclusivity to the
 * provided keyboard exclusive manager.
 */
export function createFocusGrabManager(
  keyboardExclusiveManager: KeyboardExclusiveManager,
): FocusGrabManager {
  const grabs: GrabEntry[] = [];

  return {
    grabFocus(options: FocusGrabOptions): void {
      const { surfaceId, surfaceElement, layerContainer, config, onDismiss } = options;

      // Remove existing grab for this surface if present
      const existingIdx = grabs.findIndex((g) => g.surfaceId === surfaceId);
      if (existingIdx !== -1) {
        const existing = grabs[existingIdx];
        if (existing.backdrop) {
          existing.backdrop.remove();
        }
        grabs.splice(existingIdx, 1);
      }

      let backdrop: HTMLDivElement | null = null;
      let clickHandler: (() => void) | null = null;

      // Create backdrop if configured
      if (config.backdrop !== false && config.backdrop !== undefined) {
        backdrop = document.createElement("div");
        backdrop.className = "layer-backdrop";
        backdrop.dataset.grabSurface = surfaceId;
        backdrop.style.position = "absolute";
        backdrop.style.inset = "0";
        backdrop.style.pointerEvents = "auto";
        backdrop.style.transition = "opacity 150ms ease";
        backdrop.style.opacity = "0";

        // Resolve backdrop color
        const color =
          typeof config.backdrop === "string" ? config.backdrop : DEFAULT_BACKDROP_COLOR;
        backdrop.style.background = color;

        // Insert before the surface element
        layerContainer.insertBefore(backdrop, surfaceElement);

        // Fade in on next frame
        requestAnimationFrame(() => {
          if (backdrop) {
            backdrop.style.opacity = "1";
          }
        });

        // Dismiss on outside click
        if (config.dismissOnOutsideClick && onDismiss) {
          clickHandler = onDismiss;
          backdrop.addEventListener("click", clickHandler);
        }
      }

      grabs.push({ surfaceId, backdrop, clickHandler });

      // Activate exclusive keyboard routing
      keyboardExclusiveManager.pushExclusive(surfaceId, surfaceElement);
      surfaceElement.focus();
    },

    releaseFocus(surfaceId: string): void {
      const idx = grabs.findIndex((g) => g.surfaceId === surfaceId);
      if (idx === -1) return;

      const entry = grabs[idx];
      if (entry.backdrop) {
        if (entry.clickHandler) {
          entry.backdrop.removeEventListener("click", entry.clickHandler);
        }
        entry.backdrop.remove();
      }
      grabs.splice(idx, 1);

      keyboardExclusiveManager.popExclusive(surfaceId);
    },

    getActiveGrab(): GrabEntry | null {
      return grabs.length > 0 ? grabs[grabs.length - 1] : null;
    },
  };
}
