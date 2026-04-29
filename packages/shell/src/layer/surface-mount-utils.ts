import type { LayerSurfaceContext, PluginLayerSurfaceContribution } from "@ghost-shell/contracts";
import { resolveModuleMountFn } from "@ghost-shell/contracts";
import type { PluginHost, ShellRuntime } from "../app/types.js";
import type { MountCleanup } from "../federation-mount-utils.js";

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
  const fn = resolveModuleMountFn(moduleValue, {
    topLevelNames: ["mountSurface", "mount"],
    collectionName: "surfaces",
    collectionKeys: [surface.component, surface.id],
    checkDefault: true,
  });

  return (fn as MountSurfaceComponentFn) ?? null;
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
  runtime: PluginHost,
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
