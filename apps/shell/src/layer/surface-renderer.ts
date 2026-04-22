import type {
  PluginLayerSurfaceContribution,
  LayerSurfaceContext,
  ElementTransitionHook,
} from "@ghost/plugin-contracts";
import {
  evaluateContributionPredicate,
  HOOK_REGISTRY_SERVICE_ID,
  ELEMENT_TRANSITION_HOOK_ID,
} from "@ghost/plugin-contracts";
import type { LayerRegistry } from "./registry.js";
import type { ShellRuntime } from "../app/types.js";
import type { ShellFederationRuntime } from "../federation-runtime.js";
import { safeUnmount, type MountCleanup } from "../federation-mount-utils.js";
import { composeSurfaceKey } from "./surface-mount-utils.js";
import { computeExclusiveZones } from "./anchor-positioning.js";
import { type KeyboardExclusiveManager, createKeyboardExclusiveManager } from "./input-behavior.js";
import { type FocusGrabManager, createFocusGrabManager } from "./focus-grab.js";
import { type SessionLockManager, createSessionLockManager } from "./session-lock.js";
import { reconcileLayerContainer, type ReconcilerContext } from "./surface-reconciler.js";
import { type HookRegistry } from "../hook-registry.js";

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

export interface SurfaceMountState {
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
  onSurfaceMounted?: (surfaceId: string, pluginId: string) => void;
  onSurfaceMountError?: (surfaceId: string, pluginId: string, error: unknown) => void;
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
  const onSurfaceMounted = options.onSurfaceMounted;
  const onSurfaceMountError = options.onSurfaceMountError;
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

  function buildReconcilerContext(runtime: ShellRuntime): ReconcilerContext {
    const snapshot = runtime.registry.getSnapshot();
    const pluginSnapshotMap = new Map(snapshot.plugins.map((p) => [p.id, p]));
    return {
      mounted,
      registeredRemoteIds,
      builtInSurfaceMounts,
      layerRegistry,
      federationRuntime,
      focusGrabManager,
      pluginSnapshotMap,
      get generation() { return generation; },
      cleanupSurfaceBehaviors,
      maybeActivateSurfaceBehaviors,
      onSurfaceMounted,
      onSurfaceMountError,
      onSurfaceEntering(el: HTMLElement, _surfaceId: string, _pluginId: string) {
        const hookReg = runtime.registry.getService(HOOK_REGISTRY_SERVICE_ID) as HookRegistry | null;
        if (!hookReg) return;
        const hooks = hookReg.getHooks<ElementTransitionHook>(ELEMENT_TRANSITION_HOOK_ID);
        for (const hook of hooks) {
          hook.onEnter?.(el, { type: "surface", id: _surfaceId });
        }
      },
      async onSurfaceExiting(el: HTMLElement, _surfaceId: string, _pluginId: string) {
        const hookReg = runtime.registry.getService(HOOK_REGISTRY_SERVICE_ID) as HookRegistry | null;
        if (!hookReg) return;
        const hooks = hookReg.getHooks<ElementTransitionHook>(ELEMENT_TRANSITION_HOOK_ID);
        const exitPromises = hooks
          .filter(h => typeof h.onExit === "function")
          .map(h => h.onExit!(el, { type: "surface", id: _surfaceId }));
        if (exitPromises.length > 0) {
          await Promise.all(exitPromises);
        }
      },
    };
  }

  function renderLayerSurfaces(runtime: ShellRuntime): void {
    generation += 1;
    const currentGeneration = generation;

    const allSurfaces = layerRegistry.getAllSurfaces();

    // Filter out surfaces whose when-condition evaluates to false
    const visibleSurfaces = filterByWhenCondition(allSurfaces);

    // Build the desired set of surface IDs
    const desiredIds = new Set(visibleSurfaces.map((s) => composeSurfaceKey(s.pluginId, s.surface.id)));

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
    const surfacesByLayer = groupByLayer(visibleSurfaces);

    // Compute exclusive zones and set CSS custom properties
    const zones = computeExclusiveZones(visibleSurfaces);
    layerHost.style.setProperty("--layer-exclusive-top", `${zones.top}px`);
    layerHost.style.setProperty("--layer-exclusive-right", `${zones.right}px`);
    layerHost.style.setProperty("--layer-exclusive-bottom", `${zones.bottom}px`);
    layerHost.style.setProperty("--layer-exclusive-left", `${zones.left}px`);

    // Reconcile each layer container
    const ctx = buildReconcilerContext(runtime);
    for (const [layerName, surfaces] of surfacesByLayer) {
      const container = layerHost.querySelector<HTMLElement>(`.shell-layer[data-layer="${layerName}"]`);
      if (!container) continue;

      const sorted = [...surfaces].sort((a, b) => (a.surface.order ?? 0) - (b.surface.order ?? 0));
      reconcileLayerContainer(ctx, container, sorted, runtime, currentGeneration);
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
    registeredRemoteIds.clear();
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

// ---------------------------------------------------------------------------
// When-condition evaluation
// ---------------------------------------------------------------------------

/** Filter surfaces by their `when` predicate. Surfaces without `when` always pass. */
export function filterByWhenCondition(
  surfaces: Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>,
  facts: Record<string, unknown> = {},
): Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }> {
  return surfaces.filter((entry) =>
    evaluateContributionPredicate(entry.surface.when, facts),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByLayer(
  surfaces: Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>,
): Map<string, Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>> {
  const map = new Map<string, Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>>();
  for (const entry of surfaces) {
    let list = map.get(entry.surface.layer);
    if (!list) {
      list = [];
      map.set(entry.surface.layer, list);
    }
    list.push(entry);
  }
  return map;
}
