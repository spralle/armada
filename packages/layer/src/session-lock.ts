import type { KeyboardExclusiveManager } from "./input-behavior.js";

// ---------------------------------------------------------------------------
// Session lock manager
// ---------------------------------------------------------------------------

/** Z-order threshold: overlay layer. Surfaces above this are blocked during lock. */
const OVERLAY_Z_ORDER = 600;

interface LockState {
  surfaceId: string;
  surfaceElement: HTMLDivElement;
  /** Saved inline styles so we can restore on unlock. */
  savedStyles: Array<{ element: HTMLElement; display: string; visibility: string; pointerEvents: string }>;
}

export interface SessionLockManager {
  /** Activate session lock for the given surface. */
  activateLock(surfaceId: string, surfaceElement: HTMLDivElement, overlayContainer: HTMLElement): void;
  /** Release the lock. Only the surface that activated the lock may release it. */
  releaseLock(surfaceId: string): void;
  /** Whether a session lock is currently active. */
  isLocked(): boolean;
  /** The surface ID holding the lock, or null. */
  getActiveLockSurfaceId(): string | null;
  /** Whether a new surface can be added at the given z-order. */
  canAddSurface(layerZOrder: number): boolean;
}

export interface SessionLockManagerOptions {
  layerHost: HTMLElement;
  keyboardExclusiveManager: KeyboardExclusiveManager;
}

/**
 * Create a session lock manager that enforces exclusive overlay lock semantics.
 *
 * When a session lock surface activates:
 * - The main layer (`data-layer="main"`) is hidden via `display: none`
 * - All layer sections with `data-z` below the overlay z-order get
 *   `visibility: hidden` and `pointer-events: none`
 * - The lock surface receives exclusive keyboard input
 * - No new surfaces can be contributed above the overlay z-order
 *
 * Only the lock surface's own `releaseLock()` call restores normal state.
 */
export function createSessionLockManager(
  options: SessionLockManagerOptions,
): SessionLockManager {
  const { layerHost, keyboardExclusiveManager } = options;
  let activeLock: LockState | null = null;

  return {
    activateLock(surfaceId: string, surfaceElement: HTMLDivElement, _overlayContainer: HTMLElement): void {
      if (activeLock) return; // Already locked

      const savedStyles: LockState["savedStyles"] = [];

      // Find all .shell-layer children of layerHost
      const sections = layerHost.querySelectorAll<HTMLElement>(".shell-layer");

      for (const section of sections) {
        const saved = {
          element: section,
          display: section.style.display,
          visibility: section.style.visibility,
          pointerEvents: section.style.pointerEvents,
        };
        savedStyles.push(saved);

        const isMain = section.dataset.layer === "main";
        const zStr = section.dataset.z;
        const z = zStr != null ? Number(zStr) : -1;

        if (isMain) {
          // Main layer: hide completely
          section.style.display = "none";
        } else if (z < OVERLAY_Z_ORDER) {
          // Layers below overlay: suppress visibility and pointer events
          section.style.visibility = "hidden";
          section.style.pointerEvents = "none";
        }
        // Overlay layer itself (z === 600) and anything at overlay level stays visible
      }

      // Push exclusive keyboard for the lock surface
      keyboardExclusiveManager.pushExclusive(surfaceId, surfaceElement);

      activeLock = { surfaceId, surfaceElement, savedStyles };
    },

    releaseLock(surfaceId: string): void {
      if (!activeLock || activeLock.surfaceId !== surfaceId) return;

      // Restore all saved styles
      for (const { element, display, visibility, pointerEvents } of activeLock.savedStyles) {
        element.style.display = display;
        element.style.visibility = visibility;
        element.style.pointerEvents = pointerEvents;
      }

      // Pop exclusive keyboard
      keyboardExclusiveManager.popExclusive(surfaceId);

      activeLock = null;
    },

    isLocked(): boolean {
      return activeLock !== null;
    },

    getActiveLockSurfaceId(): string | null {
      return activeLock?.surfaceId ?? null;
    },

    canAddSurface(layerZOrder: number): boolean {
      if (!activeLock) return true;
      // Block surfaces above the overlay z-order when locked
      return layerZOrder <= OVERLAY_Z_ORDER;
    },
  };
}
