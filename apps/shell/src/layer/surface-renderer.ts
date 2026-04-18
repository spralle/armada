import type {
  PluginLayerSurfaceContribution,
  LayerSurfaceContext,
  FocusGrabConfig,
} from "@ghost/plugin-contracts";
import type { LayerRegistry } from "./registry.js";
import type { ShellRuntime } from "../app/types.js";
import type { ShellFederationRuntime } from "../federation-runtime.js";
import {
  type MountCleanup,
  normalizeCleanup,
  safeUnmount,
  toRecord,
  ensureRemoteRegistered,
} from "../federation-mount-utils.js";
import { applyVisualEffects } from "./visual-effects.js";

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
}

export function createLayerSurfaceRenderer(
  options: LayerSurfaceRendererOptions,
): LayerSurfaceRenderer {
  const { federationRuntime, layerRegistry, layerHost } = options;
  const mounted = new Map<string, SurfaceMountState>();
  const registeredRemoteIds = new Set<string>();
  const builtInSurfaceMounts = new Map<string, BuiltInSurfaceMountFn>();
  let generation = 0;

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
        target.style.pointerEvents = "auto";
        target.style.position = "absolute";

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
    const surfaceContext = createSurfaceContextStub(key, surface.layer);

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
    } catch {
      // Mount failed — surface stays empty, no crash.
    }
  }

  function dispose(): void {
    for (const state of mounted.values()) {
      safeUnmount(state.cleanup);
      state.element.remove();
    }
    mounted.clear();
    generation += 1;
  }

  return { renderLayerSurfaces, dispose, registerBuiltInSurfaceMount };
}

// ---------------------------------------------------------------------------
// Surface mount resolution
// ---------------------------------------------------------------------------

type MountSurfaceComponentFn = (
  target: HTMLElement,
  context: {
    surface: PluginLayerSurfaceContribution;
    pluginId: string;
    surfaceContext: LayerSurfaceContext;
    runtime: ShellRuntime;
  },
) => MountCleanup | Promise<MountCleanup>;

function resolveSurfaceMount(
  moduleValue: unknown,
  surface: PluginLayerSurfaceContribution,
): MountSurfaceComponentFn | null {
  const moduleRecord = toRecord(moduleValue);
  if (!moduleRecord) {
    return null;
  }

  // Try: module.mountSurface (generic mount function)
  if (typeof moduleRecord.mountSurface === "function") {
    return moduleRecord.mountSurface as MountSurfaceComponentFn;
  }

  // Try: module.surfaces[component].mount or module.surfaces[component] (function)
  const surfaces = toRecord(moduleRecord.surfaces);
  if (surfaces) {
    const candidate = surfaces[surface.component] ?? surfaces[surface.id];
    if (typeof candidate === "function") {
      return candidate as MountSurfaceComponentFn;
    }
    const candidateRecord = toRecord(candidate);
    if (candidateRecord && typeof candidateRecord.mount === "function") {
      return candidateRecord.mount as MountSurfaceComponentFn;
    }
  }

  // Try: module.default
  if (typeof moduleRecord.default === "function") {
    return moduleRecord.default as MountSurfaceComponentFn;
  }
  const defaultRecord = toRecord(moduleRecord.default);
  if (defaultRecord && typeof defaultRecord.mount === "function") {
    return defaultRecord.mount as MountSurfaceComponentFn;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function composeSurfaceKey(pluginId: string, surfaceId: string): string {
  return `${pluginId}--${surfaceId}`;
}

function createSurfaceMountKey(
  pluginId: string,
  surface: PluginLayerSurfaceContribution,
  runtime: ShellRuntime,
): string {
  const snapshot = runtime.registry.getSnapshot();
  const pluginSnapshot = snapshot.plugins.find((p) => p.id === pluginId);
  if (!pluginSnapshot) {
    return `${pluginId}|${surface.id}|missing`;
  }
  const enabledState = pluginSnapshot.enabled ? "enabled" : "disabled";
  const lifecycleState = pluginSnapshot.lifecycle?.state ?? "lifecycle:unknown";
  return [pluginId, surface.id, enabledState, lifecycleState].join("|");
}

/**
 * Stub LayerSurfaceContext — full implementation in WP-12.
 */
function createSurfaceContextStub(surfaceId: string, layerName: string): LayerSurfaceContext {
  const noop = { dispose: () => {} };
  return {
    surfaceId,
    layerName,
    onConfigure: () => noop,
    onClose: () => noop,
    getExclusiveZones: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    setLayer: () => {},
    setOpacity: () => {},
    setExclusiveZone: () => {},
    dismiss: () => {},
    grabFocus: () => {},
    releaseFocus: () => {},
  };
}
