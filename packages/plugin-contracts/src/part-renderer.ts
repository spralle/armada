import type { Disposable } from "./disposable.js";
import type { PluginMountContext } from "./plugin-services.js";

/**
 * Context provided to a renderer when mounting a plugin part.
 * Renderer-agnostic — implementations interpret this per framework.
 */
export interface PartRenderContext {
  /** The DOM element to render into. */
  readonly container: HTMLElement;
  /** Plugin mount context provided by the shell. */
  readonly mountContext: PluginMountContext;
  /** Unique ID of the part being rendered. */
  readonly partId: string;
  /** The plugin ID that owns this part. */
  readonly pluginId: string;
}

/**
 * Handle returned by a renderer after mounting a part.
 * Used for lifecycle management (update, unmount).
 */
export interface PartRenderHandle extends Disposable {
  /** Update the rendered part (e.g., new props or context). */
  update?(context: PartRenderContext): void;
}

/**
 * Renderer protocol for plugin parts.
 * Shell delegates part mounting/unmounting to the active renderer.
 * Implementations: ReactPartRenderer, VanillaDomRenderer, etc.
 */
export interface PartRenderer {
  /** Unique identifier for this renderer (e.g., "react", "vanilla-dom"). */
  readonly id: string;
  /** Returns true if this renderer can handle the given part. */
  canRender(partId: string, pluginId: string): boolean;
  /** Mount a part into the given container. */
  mount(context: PartRenderContext): PartRenderHandle;
}
