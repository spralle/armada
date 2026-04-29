import type { FocusGrabConfig, LayerSurfaceContext } from "@ghost-shell/contracts/layer";
import type { FocusGrabManager } from "./focus-grab.js";
import type { LayerRegistry } from "./registry.js";
import { setDynamicOpacity } from "./visual-effects.js";

/**
 * Options for creating a {@link LayerSurfaceContext}.
 */
export interface LayerSurfaceContextOptions {
  surfaceId: string;
  element: HTMLDivElement;
  layerName: string;
  layerContainer: HTMLElement;
  layerRegistry: LayerRegistry;
  focusGrabManager: FocusGrabManager;
  onDismiss: () => void;
  onLayerChange?: (newLayerName: string) => void;
  onExclusiveZoneChange?: (value: number) => void;
}

/**
 * Create a {@link LayerSurfaceContext} that provides the runtime API for a
 * mounted layer surface.  The returned object satisfies the contract defined
 * in `@ghost-shell/contracts` and is passed to the plugin mount function.
 */
export function createLayerSurfaceContext(options: LayerSurfaceContextOptions): LayerSurfaceContext {
  const {
    surfaceId,
    element,
    layerContainer,
    layerRegistry,
    focusGrabManager,
    onDismiss,
    onLayerChange,
    onExclusiveZoneChange,
  } = options;

  let currentLayerName = options.layerName;
  let _currentExclusiveZone = 0;
  let dismissed = false;

  // --- callback bookkeeping ------------------------------------------------
  const closeCallbacks: Array<() => void> = [];

  // --- ResizeObserver bookkeeping ------------------------------------------
  let resizeObserver: ResizeObserver | null = null;

  // --- helpers -------------------------------------------------------------

  function assertNotDismissed(method: string): void {
    if (dismissed) {
      console.warn(`[LayerSurfaceContext] ${method}() called on dismissed surface '${surfaceId}'`);
    }
  }

  // --- public API ----------------------------------------------------------

  const context: LayerSurfaceContext = {
    get surfaceId() {
      return surfaceId;
    },

    get layerName() {
      return currentLayerName;
    },

    onConfigure(callback: (rect: { width: number; height: number }) => void): { dispose(): void } {
      assertNotDismissed("onConfigure");

      // Disconnect previous observer to prevent orphaned watchers
      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          callback({ width, height });
        }
      });

      observer.observe(element);
      resizeObserver = observer;

      return {
        dispose() {
          observer.disconnect();
          if (resizeObserver === observer) {
            resizeObserver = null;
          }
        },
      };
    },

    onClose(callback: () => void): { dispose(): void } {
      assertNotDismissed("onClose");
      closeCallbacks.push(callback);

      return {
        dispose() {
          const idx = closeCallbacks.indexOf(callback);
          if (idx !== -1) closeCallbacks.splice(idx, 1);
        },
      };
    },

    getExclusiveZones(): { top: number; right: number; bottom: number; left: number } {
      // Read CSS custom properties set by the layer host on the layer container.
      const style = getComputedStyle(layerContainer);
      return {
        top: parseFloat(style.getPropertyValue("--layer-inset-top")) || 0,
        right: parseFloat(style.getPropertyValue("--layer-inset-right")) || 0,
        bottom: parseFloat(style.getPropertyValue("--layer-inset-bottom")) || 0,
        left: parseFloat(style.getPropertyValue("--layer-inset-left")) || 0,
      };
    },

    setLayer(name: string): void {
      assertNotDismissed("setLayer");

      const layer = layerRegistry.getLayer(name);
      if (!layer) {
        console.warn(`[LayerSurfaceContext] setLayer: layer '${name}' does not exist`);
        return;
      }

      // Move the surface element to the new layer's DOM container
      const layerHost = layerContainer.parentElement;
      if (layerHost) {
        const newContainer = layerHost.querySelector<HTMLElement>(`.shell-layer[data-layer="${name}"]`);
        if (newContainer) {
          newContainer.appendChild(element);
        }
      }

      currentLayerName = name;
      onLayerChange?.(name);
    },

    setOpacity(value: number): void {
      assertNotDismissed("setOpacity");
      setDynamicOpacity(element, value);
    },

    setExclusiveZone(value: number): void {
      assertNotDismissed("setExclusiveZone");
      _currentExclusiveZone = value;
      onExclusiveZoneChange?.(value);
    },

    dismiss(): void {
      if (dismissed) return;
      dismissed = true;

      // Invoke all onClose callbacks
      for (const cb of [...closeCallbacks]) {
        try {
          cb();
        } catch (err) {
          console.error(`[LayerSurfaceContext] onClose callback error for '${surfaceId}':`, err);
        }
      }
      closeCallbacks.length = 0;

      // Cleanup ResizeObserver
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      // Notify renderer to remove the surface
      onDismiss();
    },

    grabFocus(grabOptions?: FocusGrabConfig): void {
      assertNotDismissed("grabFocus");
      focusGrabManager.grabFocus({
        surfaceId,
        surfaceElement: element,
        layerContainer,
        config: grabOptions ?? {},
        // Safe from grabFocus→onDismiss→dismiss recursion: the `dismissed` flag above is checked first
        onDismiss: () => context.dismiss(),
      });
    },

    releaseFocus(): void {
      assertNotDismissed("releaseFocus");
      focusGrabManager.releaseFocus(surfaceId);
    },
  };

  return context;
}
