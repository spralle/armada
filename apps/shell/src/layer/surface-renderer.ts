import {
  type PluginLayerSurfaceContribution,
  type LayerSurfaceContext,
  InputBehavior,
  KeyboardInteractivity,
} from "@ghost/plugin-contracts";
import type { LayerRegistry } from "./registry.js";
import type { ShellRuntime } from "../app/types.js";
import type { ShellFederationRuntime } from "../federation-runtime.js";
import {
  type MountCleanup,
  normalizeCleanup,
  safeUnmount,
  ensureRemoteRegistered,
} from "../federation-mount-utils.js";
import { applyVisualEffects } from "./visual-effects.js";
import { createLayerSurfaceContext } from "./surface-context.js";
import {
  composeSurfaceKey,
  createSurfaceMountKey,
  resolveSurfaceMount,
} from "./surface-mount-utils.js";
import { computeAnchorStyles, computeExclusiveZones } from "./anchor-positioning.js";
import { applyInputBehavior, applyKeyboardInteractivity, type KeyboardExclusiveManager, createKeyboardExclusiveManager } from "./input-behavior.js";
import { applyAutoStacking } from "./auto-stacking.js";
import { type FocusGrabManager, createFocusGrabManager } from "./focus-grab.js";
import { type SessionLockManager, createSessionLockManager } from "./session-lock.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BuiltInSurfaceMountFn = (
  target: HTMLElement,
  context: {
    surface: PluginLayerSurfaceContribution;
    pluginId: string;
    surfaceContext: LayerSurfaceContext;
    runtime: ShellRuntime;
  },
) => MountCleanup | Promise<MountCleanup>;

interface SurfaceMountState {
  surfaceId: string;
  pluginId: string;
  surface: PluginLayerSurfaceContribution;
  element: HTMLDivElement;
  cleanup: (() => void) | null;
  mountKey: string;
  generation: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface LayerSurfaceRendererOptions {
  federationRuntime: ShellFederationRuntime;
  layerRegistry: LayerRegistry;
  layerHost: HTMLElement;
}

export interface LayerSurfaceRenderer {
  renderLayerSurfaces(runtime: ShellRuntime): void;
  dispose(): void;
  registerBuiltInSurfaceMount(component: string, mountFn: BuiltInSurfaceMountFn): void;
  readonly focusGrabManager: FocusGrabManager;
  readonly sessionLockManager: SessionLockManager;
  readonly keyboardExclusiveManager: KeyboardExclusiveManager;
}

export function createLayerSurfaceRenderer(
  options: LayerSurfaceRendererOptions,
): LayerSurfaceRenderer {
  const { federationRuntime, layerRegistry, layerHost } = options;
  const mounted = new Map<string, SurfaceMountState>();
  const registeredRemoteIds = new Set<string>();
  const builtInSurfaceMounts = new Map<string, BuiltInSurfaceMountFn>();
  let generation = 0;

  const keyboardExclusiveManager = createKeyboardExclusiveManager();
  const focusGrabManager = createFocusGrabManager(keyboardExclusiveManager);
  const sessionLockManager = createSessionLockManager({ layerHost, keyboardExclusiveManager });

  layerRegistry.setSessionLockCheck((z) => sessionLockManager.canAddSurface(z));

  layerRegistry.setOnSurfacesRemoved((entries) => {
    for (const { surfaceId, pluginId } of entries) {
      const key = composeSurfaceKey(pluginId, surfaceId);
      const state = mounted.get(key);
      if (!state) continue;
      cleanupSurfaceBehaviors(key);
      safeUnmount(state.cleanup);
      state.element.remove();
      mounted.delete(key);
    }
  });

  function cleanupSurfaceBehaviors(key: string): void {
    focusGrabManager.releaseFocus(key);
    keyboardExclusiveManager.popExclusive(key);
    if (sessionLockManager.getActiveLockSurfaceId() === key) {
      sessionLockManager.releaseLock(key);
    }
  }

  function maybeActivateSurfaceBehaviors(
    key: string,
    target: HTMLElement,
    surface: PluginLayerSurfaceContribution,
  ): void {
    if (surface.focusGrab) {
      const container = target.parentElement;
      if (container) {
        focusGrabManager.grabFocus({
          surfaceId: key,
          surfaceElement: target as HTMLDivElement,
          layerContainer: container,
          config: surface.focusGrab,
          onDismiss: () => {
          const state = mounted.get(key);
          if (state) {
            safeUnmount(state.cleanup);
            cleanupSurfaceBehaviors(key);
            target.remove();
            mounted.delete(key);
          }
        },
        });
      }
    }

    if (surface.sessionLock) {
      sessionLockManager.activateLock(key, target as HTMLDivElement, target.parentElement!);
    }
  }

  function registerBuiltInSurfaceMount(component: string, mountFn: BuiltInSurfaceMountFn): void {
    builtInSurfaceMounts.set(component, mountFn);
  }

  function renderLayerSurfaces(runtime: ShellRuntime): void {
    generation += 1;
    const currentGeneration = generation;

    const allSurfaces = layerRegistry.getAllSurfaces();

    // Build the desired set of surface IDs
    const desiredIds = new Set(allSurfaces.map((s) => composeSurfaceKey(s.pluginId, s.surface.id)));

    // Unmount surfaces no longer in desired set
    for (const [key, state] of mounted.entries()) {
      if (!desiredIds.has(key)) {
        cleanupSurfaceBehaviors(key);
        safeUnmount(state.cleanup);
        state.element.remove();
        mounted.delete(key);
      }
    }

    // Group surfaces by layer
    const surfacesByLayer = new Map<string, Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>>();
    for (const entry of allSurfaces) {
      let list = surfacesByLayer.get(entry.surface.layer);
      if (!list) {
        list = [];
        surfacesByLayer.set(entry.surface.layer, list);
      }
      list.push(entry);
    }

    // Compute exclusive zones and set CSS custom properties
    const zones = computeExclusiveZones(allSurfaces);
    layerHost.style.setProperty("--layer-exclusive-top", `${zones.top}px`);
    layerHost.style.setProperty("--layer-exclusive-right", `${zones.right}px`);
    layerHost.style.setProperty("--layer-exclusive-bottom", `${zones.bottom}px`);
    layerHost.style.setProperty("--layer-exclusive-left", `${zones.left}px`);

    // Reconcile each layer container
    for (const [layerName, surfaces] of surfacesByLayer) {
      const container = layerHost.querySelector<HTMLElement>(`.shell-layer[data-layer="${layerName}"]`);
      if (!container) {
        continue;
      }

      // Sort by order
      const sorted = surfaces.sort((a, b) => (a.surface.order ?? 0) - (b.surface.order ?? 0));

      reconcileLayerContainer(container, sorted, runtime, currentGeneration);
    }
  }

  function reconcileLayerContainer(
    container: HTMLElement,
    surfaces: Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>,
    runtime: ShellRuntime,
    currentGeneration: number,
  ): void {
    const desiredIds = new Set(surfaces.map((s) => composeSurfaceKey(s.pluginId, s.surface.id)));

    // Remove elements for surfaces no longer in this container
    for (const child of Array.from(container.children) as HTMLElement[]) {
      const surfaceId = child.dataset.surfaceId;
      if (surfaceId && !desiredIds.has(surfaceId)) {
        const state = mounted.get(surfaceId);
        if (state) {
          cleanupSurfaceBehaviors(surfaceId);
          safeUnmount(state.cleanup);
          mounted.delete(surfaceId);
        }
        child.remove();
      }
    }

    // Ensure surface elements exist in correct order
    let previousElement: Element | null = null;
    for (const { pluginId, surface } of surfaces) {
      const key = composeSurfaceKey(pluginId, surface.id);

      let target = container.querySelector<HTMLDivElement>(`[data-surface-id="${key}"]`);

      if (!target) {
        target = document.createElement("div");
        target.className = "layer-surface";
        target.dataset.surfaceId = key;
        target.dataset.plugin = pluginId;

        const anchorStyles = computeAnchorStyles(surface);
        Object.assign(target.style, anchorStyles);

        const layerDef = layerRegistry.getLayer(surface.layer);
        applyInputBehavior(target, surface.inputBehavior ?? layerDef?.defaultPointer ?? InputBehavior.Opaque);
        applyKeyboardInteractivity(target, surface.keyboardInteractivity ?? layerDef?.defaultKeyboard ?? KeyboardInteractivity.None);

        applyVisualEffects(target, surface.opacity, surface.backdropFilter);

        if (previousElement && previousElement.nextSibling) {
          container.insertBefore(target, previousElement.nextSibling);
        } else if (!previousElement && container.firstChild) {
          container.insertBefore(target, container.firstChild);
        } else {
          container.appendChild(target);
        }
      }

      previousElement = target;

      // Mount if not already mounted with same key
      const existing = mounted.get(key);
      const mountKey = createSurfaceMountKey(pluginId, surface, runtime);

      if (existing && existing.element === target && existing.mountKey === mountKey) {
        continue;
      }

      if (existing) {
        safeUnmount(existing.cleanup);
        mounted.delete(key);
      }

      // Fire and forget async mount
      void mountSurfaceComponent(target, pluginId, surface, runtime, key, mountKey, currentGeneration);
    }

    // Apply auto-stacking for surfaces sharing anchor points
    const stackedSurfaces = surfaces
      .map(({ pluginId: pid, surface: s }) => {
        const k = composeSurfaceKey(pid, s.id);
        const el = container.querySelector<HTMLElement>(`[data-surface-id="${k}"]`);
        return el ? { surfaceId: k, surface: s, element: el } : null;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
    applyAutoStacking(stackedSurfaces);
  }

  async function mountSurfaceComponent(
    target: HTMLDivElement,
    pluginId: string,
    surface: PluginLayerSurfaceContribution,
    runtime: ShellRuntime,
    key: string,
    mountKey: string,
    expectedGeneration: number,
  ): Promise<void> {
    const container = target.parentElement as HTMLElement;
    const surfaceContext = createLayerSurfaceContext({
      surfaceId: key,
      element: target,
      layerName: surface.layer,
      layerContainer: container,
      layerRegistry,
      focusGrabManager,
      onDismiss: () => {
        safeUnmount(mounted.get(key)?.cleanup ?? null);
        cleanupSurfaceBehaviors(key);
        target.remove();
        mounted.delete(key);
      },
      onLayerChange: () => {
        // Re-render will reconcile the new position
      },
      onExclusiveZoneChange: () => {
        // Exclusive zone changes are picked up on next render cycle
      },
    });

    // --- Built-in fast path ---
    const builtInMount = builtInSurfaceMounts.get(surface.component);
    if (builtInMount) {
      try {
        const cleanupResult = await builtInMount(target, {
          surface,
          pluginId,
          surfaceContext,
          runtime,
        });
        const cleanup = normalizeCleanup(cleanupResult);

        if (generation !== expectedGeneration) {
          safeUnmount(cleanup);
          return;
        }

        mounted.set(key, { surfaceId: key, pluginId, surface, element: target, cleanup, mountKey, generation: expectedGeneration });
        maybeActivateSurfaceBehaviors(key, target, surface);
      } catch {
        // Built-in mount failed — surface stays empty, no crash.
      }
      return;
    }

    // --- Module Federation path ---
    const snapshot = runtime.registry.getSnapshot();
    const pluginSnapshot = snapshot.plugins.find((p) => p.id === pluginId);

    ensureRemoteRegistered(
      pluginId,
      registeredRemoteIds,
      () => pluginSnapshot?.descriptor,
      (desc) => federationRuntime.registerRemote(desc),
    );

    try {
      const remoteModule = await federationRuntime.loadRemoteModule(
        pluginId,
        "./pluginLayerSurfaces",
      );

      if (generation !== expectedGeneration) {
        return;
      }

      const mountFn = resolveSurfaceMount(remoteModule, surface);
      if (!mountFn) {
        return;
      }

      const cleanupResult = await mountFn(target, {
        surface,
        pluginId,
        surfaceContext,
        runtime,
      });
      const cleanup = normalizeCleanup(cleanupResult);

      if (generation !== expectedGeneration) {
        safeUnmount(cleanup);
        return;
      }

      mounted.set(key, { surfaceId: key, pluginId, surface, element: target, cleanup, mountKey, generation: expectedGeneration });
      maybeActivateSurfaceBehaviors(key, target, surface);
    } catch {
      // Mount failed — surface stays empty, no crash.
    }
  }

  function dispose(): void {
    const lockId = sessionLockManager.getActiveLockSurfaceId();
    if (lockId) sessionLockManager.releaseLock(lockId);

    for (const state of mounted.values()) {
      cleanupSurfaceBehaviors(state.surfaceId);
      safeUnmount(state.cleanup);
      state.element.remove();
    }
    mounted.clear();
    keyboardExclusiveManager.dispose();
    generation += 1;
  }

  return {
    renderLayerSurfaces,
    dispose,
    registerBuiltInSurfaceMount,
    focusGrabManager,
    sessionLockManager,
    keyboardExclusiveManager,
  };
}
