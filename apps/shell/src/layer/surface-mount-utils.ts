import type {
  PluginLayerSurfaceContribution,
  LayerSurfaceContext,
} from "@ghost-shell/contracts";
import type { ShellRuntime } from "../app/types.js";
import { type MountCleanup, toRecord } from "../federation-mount-utils.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MountSurfaceComponentFn = (
  target: HTMLElement,
  context: {
    surface: PluginLayerSurfaceContribution;
    pluginId: string;
    surfaceContext: LayerSurfaceContext;
    runtime: ShellRuntime;
  },
) => MountCleanup | Promise<MountCleanup>;

// ---------------------------------------------------------------------------
// Surface mount resolution
// ---------------------------------------------------------------------------

export function resolveSurfaceMount(
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

  // Try: module.mount (named export)
  if (typeof moduleRecord.mount === "function") {
    return moduleRecord.mount as MountSurfaceComponentFn;
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

export function composeSurfaceKey(pluginId: string, surfaceId: string): string {
  return `${pluginId}--${surfaceId}`;
}

export function createSurfaceMountKey(
  pluginId: string,
  surface: PluginLayerSurfaceContribution,
  runtime: ShellRuntime,
  pluginSnapshotMap?: Map<string, { enabled: boolean; lifecycle?: { state: string } }>,
): string {
  const pluginSnapshot = pluginSnapshotMap
    ? pluginSnapshotMap.get(pluginId)
    : runtime.registry.getSnapshot().plugins.find((p) => p.id === pluginId);
  if (!pluginSnapshot) {
    return `${pluginId}|${surface.id}|missing`;
  }
  const enabledState = pluginSnapshot.enabled ? "enabled" : "disabled";
  const lifecycleState = pluginSnapshot.lifecycle?.state ?? "lifecycle:unknown";
  return [pluginId, surface.id, enabledState, lifecycleState].join("|");
}
