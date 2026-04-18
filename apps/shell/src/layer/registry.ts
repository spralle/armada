import type {
  LayerDefinition,
  PluginLayerDefinition,
  PluginLayerSurfaceContribution,
} from "@ghost/plugin-contracts";
import { KeyboardInteractivity, InputBehavior } from "@ghost/plugin-contracts";

/** The 7 built-in layers with generous z-order gaps for plugin insertion. */
export const BUILTIN_LAYERS: readonly LayerDefinition[] = [
  { name: "background", zOrder: 0, defaultKeyboard: KeyboardInteractivity.None, defaultPointer: InputBehavior.Passthrough, supportsSessionLock: false, pluginContributable: true },
  { name: "bottom", zOrder: 100, defaultKeyboard: KeyboardInteractivity.None, defaultPointer: InputBehavior.Opaque, supportsSessionLock: false, pluginContributable: true },
  { name: "main", zOrder: 200, defaultKeyboard: KeyboardInteractivity.OnDemand, defaultPointer: InputBehavior.Opaque, supportsSessionLock: false, pluginContributable: false },
  { name: "floating", zOrder: 300, defaultKeyboard: KeyboardInteractivity.OnDemand, defaultPointer: InputBehavior.Opaque, supportsSessionLock: false, pluginContributable: true },
  { name: "notification", zOrder: 400, defaultKeyboard: KeyboardInteractivity.None, defaultPointer: InputBehavior.ContentAware, supportsSessionLock: false, pluginContributable: true },
  { name: "modal", zOrder: 500, defaultKeyboard: KeyboardInteractivity.Exclusive, defaultPointer: InputBehavior.Opaque, supportsSessionLock: false, pluginContributable: true },
  { name: "overlay", zOrder: 600, defaultKeyboard: KeyboardInteractivity.Exclusive, defaultPointer: InputBehavior.Opaque, supportsSessionLock: true, pluginContributable: true },
] as const;

export class LayerRegistry {
  private layers: Map<string, LayerDefinition> = new Map();
  private surfaces: Map<string, { surface: PluginLayerSurfaceContribution; pluginId: string }> = new Map();

  registerBuiltinLayers(): void {
    for (const layer of BUILTIN_LAYERS) {
      this.layers.set(layer.name, { ...layer });
    }
  }

  registerPluginLayers(
    pluginId: string,
    definitions: PluginLayerDefinition[],
  ): { registered: string[]; denied: Array<{ name: string; reason: string }> } {
    const registered: string[] = [];
    const denied: Array<{ name: string; reason: string }> = [];

    for (const def of definitions) {
      const existing = this.layers.get(def.name);
      if (existing) {
        const owner = existing.pluginId ? `plugin '${existing.pluginId}'` : "built-in";
        denied.push({ name: def.name, reason: `Name conflicts with ${owner} layer` });
        continue;
      }

      this.layers.set(def.name, {
        name: def.name,
        zOrder: def.zOrder,
        defaultKeyboard: def.defaultKeyboard ?? KeyboardInteractivity.None,
        defaultPointer: def.defaultPointer ?? InputBehavior.Opaque,
        supportsSessionLock: def.supportsSessionLock ?? false,
        pluginContributable: true,
        pluginId,
      });
      registered.push(def.name);
    }

    return { registered, denied };
  }

  unregisterPluginLayers(pluginId: string): { removedLayers: string[]; affectedSurfaceIds: string[] } {
    const removedLayers: string[] = [];
    const affectedSurfaceIds: string[] = [];

    // Find layers owned by this plugin
    for (const [name, layer] of this.layers) {
      if (layer.pluginId === pluginId) {
        removedLayers.push(name);
      }
    }

    // Cascade: remove ALL surfaces on those layers (from any plugin)
    for (const layerName of removedLayers) {
      for (const [surfaceId, entry] of this.surfaces) {
        if (entry.surface.layer === layerName) {
          affectedSurfaceIds.push(surfaceId);
        }
      }
      this.layers.delete(layerName);
    }

    for (const id of affectedSurfaceIds) {
      this.surfaces.delete(id);
    }

    return { removedLayers, affectedSurfaceIds };
  }

  registerSurface(
    pluginId: string,
    surface: PluginLayerSurfaceContribution,
  ): { success: boolean; reason?: string } {
    const validation = this.validateSurfaceContribution(surface);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }
    this.surfaces.set(surface.id, { surface, pluginId });
    return { success: true };
  }

  unregisterSurfaces(pluginId: string): string[] {
    const removed: string[] = [];
    for (const [id, entry] of this.surfaces) {
      if (entry.pluginId === pluginId) {
        removed.push(id);
      }
    }
    for (const id of removed) {
      this.surfaces.delete(id);
    }
    return removed;
  }

  validateSurfaceContribution(
    surface: PluginLayerSurfaceContribution,
  ): { valid: boolean; reason?: string } {
    const layer = this.layers.get(surface.layer);
    if (!layer) {
      return { valid: false, reason: `Layer '${surface.layer}' does not exist` };
    }
    if (!layer.pluginContributable) {
      return { valid: false, reason: `Layer '${surface.layer}' does not accept plugin contributions` };
    }
    if (surface.sessionLock && !layer.supportsSessionLock) {
      return { valid: false, reason: `Layer '${surface.layer}' does not support session lock` };
    }
    return { valid: true };
  }

  getOrderedLayers(): LayerDefinition[] {
    return [...this.layers.values()].sort((a, b) => a.zOrder - b.zOrder);
  }

  getLayer(name: string): LayerDefinition | undefined {
    return this.layers.get(name);
  }

  getSurfacesForLayer(layerName: string): Array<{ surface: PluginLayerSurfaceContribution; pluginId: string }> {
    const result: Array<{ surface: PluginLayerSurfaceContribution; pluginId: string }> = [];
    for (const entry of this.surfaces.values()) {
      if (entry.surface.layer === layerName) {
        result.push(entry);
      }
    }
    return result;
  }

  getAllSurfaces(): Array<{ surface: PluginLayerSurfaceContribution; pluginId: string }> {
    return [...this.surfaces.values()];
  }
}
