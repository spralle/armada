import type { CellRendererFn } from "./cell-renderer-types.js";
import { registerBuiltins } from "./renderers/index.js";

/**
 * Registry for cell renderers. Renderers are resolved by string key.
 * The default global registry ships with built-in renderers.
 * Plugins can register custom renderers.
 */
export class CellRendererRegistry {
  private renderers = new Map<string, CellRendererFn>();

  register(key: string, renderer: CellRendererFn): void {
    this.renderers.set(key, renderer);
  }

  get(key: string): CellRendererFn | undefined {
    return this.renderers.get(key);
  }

  has(key: string): boolean {
    return this.renderers.has(key);
  }

  /** Resolve a renderer by key, falling back to 'text' if not found */
  resolve(key: string): CellRendererFn {
    return this.renderers.get(key) ?? this.renderers.get("text")!;
  }

  /** Get all registered keys */
  keys(): string[] {
    return [...this.renderers.keys()];
  }
}

/** The default global registry instance with built-in renderers */
export const defaultCellRegistry = new CellRendererRegistry();
registerBuiltins(defaultCellRegistry);
