import type {
  PluginLayerSurfaceContribution,
} from "@ghost/plugin-contracts";
import {
  InputBehavior,
  KeyboardInteractivity,
} from "@ghost/plugin-contracts";
import type { LayerRegistry } from "./registry.js";
import type { ShellRuntime } from "../app/types.js";
import type { ShellFederationRuntime } from "../federation-runtime.js";
import {
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
import { computeAnchorStyles } from "./anchor-positioning.js";
import { applyInputBehavior, applyKeyboardInteractivity } from "./input-behavior.js";
import { applyAutoStacking } from "./auto-stacking.js";
import type { BuiltInSurfaceMountFn, SurfaceMountState } from "./surface-renderer.js";
import type { FocusGrabManager } from "./focus-grab.js";

// ---------------------------------------------------------------------------
// Dependencies context passed from the renderer
// ---------------------------------------------------------------------------

export interface ReconcilerContext {
  mounted: Map<string, SurfaceMountState>;
  registeredRemoteIds: Set<string>;
  builtInSurfaceMounts: Map<string, BuiltInSurfaceMountFn>;
  layerRegistry: LayerRegistry;
  federationRuntime: ShellFederationRuntime;
  focusGrabManager: FocusGrabManager;
  generation: number;
  cleanupSurfaceBehaviors(key: string): void;
  maybeActivateSurfaceBehaviors(key: string, target: HTMLElement, surface: PluginLayerSurfaceContribution): void;
}

// ---------------------------------------------------------------------------
// reconcileLayerContainer
// ---------------------------------------------------------------------------

export function reconcileLayerContainer(
  ctx: ReconcilerContext,
  container: HTMLElement,
  surfaces: Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>,
  runtime: ShellRuntime,
  currentGeneration: number,
): void {
  const desiredIds = new Set(surfaces.map((s) => composeSurfaceKey(s.pluginId, s.surface.id)));

  removeStaleChildren(ctx, container, desiredIds);

  let previousElement: Element | null = null;
  for (const { pluginId, surface } of surfaces) {
    const key = composeSurfaceKey(pluginId, surface.id);
    let target = container.querySelector<HTMLDivElement>(`[data-surface-id="${key}"]`);

    if (!target) {
      target = createSurfaceElement(ctx, key, pluginId, surface);
      insertSurfaceElement(container, target, previousElement);
    }

    previousElement = target;

    const existing = ctx.mounted.get(key);
    const mountKey = createSurfaceMountKey(pluginId, surface, runtime);

    if (existing && existing.element === target && existing.mountKey === mountKey) {
      continue;
    }

    if (existing) {
      safeUnmount(existing.cleanup);
      ctx.mounted.delete(key);
    }

    void mountSurfaceComponent(ctx, target, pluginId, surface, runtime, key, mountKey, currentGeneration);
  }

  applyAutoStackingForContainer(container, surfaces);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function removeStaleChildren(
  ctx: ReconcilerContext,
  container: HTMLElement,
  desiredIds: Set<string>,
): void {
  for (const child of Array.from(container.children) as HTMLElement[]) {
    const surfaceId = child.dataset.surfaceId;
    if (surfaceId && !desiredIds.has(surfaceId)) {
      const state = ctx.mounted.get(surfaceId);
      if (state) {
        ctx.cleanupSurfaceBehaviors(surfaceId);
        safeUnmount(state.cleanup);
        ctx.mounted.delete(surfaceId);
      }
      child.remove();
    }
  }
}

function createSurfaceElement(
  ctx: ReconcilerContext,
  key: string,
  pluginId: string,
  surface: PluginLayerSurfaceContribution,
): HTMLDivElement {
  const target = document.createElement("div");
  target.className = "layer-surface";
  target.dataset.surfaceId = key;
  target.dataset.plugin = pluginId;

  const anchorStyles = computeAnchorStyles(surface);
  Object.assign(target.style, anchorStyles);

  const layerDef = ctx.layerRegistry.getLayer(surface.layer);
  applyInputBehavior(target, surface.inputBehavior ?? layerDef?.defaultPointer ?? InputBehavior.Opaque);
  applyKeyboardInteractivity(target, surface.keyboardInteractivity ?? layerDef?.defaultKeyboard ?? KeyboardInteractivity.None);

  applyVisualEffects(target, surface.opacity, surface.backdropFilter);

  return target;
}

function insertSurfaceElement(
  container: HTMLElement,
  target: HTMLDivElement,
  previousElement: Element | null,
): void {
  if (previousElement && previousElement.nextSibling) {
    container.insertBefore(target, previousElement.nextSibling);
  } else if (!previousElement && container.firstChild) {
    container.insertBefore(target, container.firstChild);
  } else {
    container.appendChild(target);
  }
}

function applyAutoStackingForContainer(
  container: HTMLElement,
  surfaces: Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>,
): void {
  const stackedSurfaces = surfaces
    .map(({ pluginId: pid, surface: s }) => {
      const k = composeSurfaceKey(pid, s.id);
      const el = container.querySelector<HTMLElement>(`[data-surface-id="${k}"]`);
      return el ? { surfaceId: k, surface: s, element: el } : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  applyAutoStacking(stackedSurfaces);
}

// ---------------------------------------------------------------------------
// mountSurfaceComponent
// ---------------------------------------------------------------------------

async function mountSurfaceComponent(
  ctx: ReconcilerContext,
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
    layerRegistry: ctx.layerRegistry,
    focusGrabManager: ctx.focusGrabManager,
    onDismiss: () => {
      safeUnmount(ctx.mounted.get(key)?.cleanup ?? null);
      ctx.cleanupSurfaceBehaviors(key);
      target.remove();
      ctx.mounted.delete(key);
    },
    onLayerChange: () => {},
    onExclusiveZoneChange: () => {},
  });

  const builtInMount = ctx.builtInSurfaceMounts.get(surface.component);
  if (builtInMount) {
    await mountBuiltIn(ctx, builtInMount, target, pluginId, surface, runtime, key, mountKey, expectedGeneration, surfaceContext);
    return;
  }

  await mountViaFederation(ctx, target, pluginId, surface, runtime, key, mountKey, expectedGeneration, surfaceContext);
}

async function mountBuiltIn(
  ctx: ReconcilerContext,
  builtInMount: BuiltInSurfaceMountFn,
  target: HTMLDivElement,
  pluginId: string,
  surface: PluginLayerSurfaceContribution,
  runtime: ShellRuntime,
  key: string,
  mountKey: string,
  expectedGeneration: number,
  surfaceContext: ReturnType<typeof createLayerSurfaceContext>,
): Promise<void> {
  try {
    const cleanupResult = await builtInMount(target, { surface, pluginId, surfaceContext, runtime });
    const cleanup = normalizeCleanup(cleanupResult);

    if (ctx.generation !== expectedGeneration) {
      safeUnmount(cleanup);
      return;
    }

    ctx.mounted.set(key, { surfaceId: key, pluginId, surface, element: target, cleanup, mountKey, generation: expectedGeneration });
    ctx.maybeActivateSurfaceBehaviors(key, target, surface);
  } catch {
    // Built-in mount failed — surface stays empty, no crash.
  }
}

async function mountViaFederation(
  ctx: ReconcilerContext,
  target: HTMLDivElement,
  pluginId: string,
  surface: PluginLayerSurfaceContribution,
  runtime: ShellRuntime,
  key: string,
  mountKey: string,
  expectedGeneration: number,
  surfaceContext: ReturnType<typeof createLayerSurfaceContext>,
): Promise<void> {
  const snapshot = runtime.registry.getSnapshot();
  const pluginSnapshot = snapshot.plugins.find((p) => p.id === pluginId);

  ensureRemoteRegistered(
    pluginId,
    ctx.registeredRemoteIds,
    () => pluginSnapshot?.descriptor,
    (desc) => ctx.federationRuntime.registerRemote(desc),
  );

  try {
    const remoteModule = await ctx.federationRuntime.loadRemoteModule(pluginId, "./pluginLayerSurfaces");

    if (ctx.generation !== expectedGeneration) {
      return;
    }

    const mountFn = resolveSurfaceMount(remoteModule, surface);
    if (!mountFn) {
      return;
    }

    const cleanupResult = await mountFn(target, { surface, pluginId, surfaceContext, runtime });
    const cleanup = normalizeCleanup(cleanupResult);

    if (ctx.generation !== expectedGeneration) {
      safeUnmount(cleanup);
      return;
    }

    ctx.mounted.set(key, { surfaceId: key, pluginId, surface, element: target, cleanup, mountKey, generation: expectedGeneration });
    ctx.maybeActivateSurfaceBehaviors(key, target, surface);
  } catch {
    // Mount failed — surface stays empty, no crash.
  }
}
