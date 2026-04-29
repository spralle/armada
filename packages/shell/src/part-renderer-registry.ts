/**
 * Part renderer registry — dispatches mount calls to the appropriate renderer.
 * Vanilla DOM renderer is registered as the default fallback.
 */

import type { Disposable, PartRenderer, PartRendererRegistry } from "@ghost-shell/contracts";
import { createVanillaDomRenderer } from "@ghost-shell/plugin-system";

/** Create a PartRendererRegistry with vanilla-dom as the default fallback. */
export function createPartRendererRegistry(): PartRendererRegistry {
  const rendererList: PartRenderer[] = [createVanillaDomRenderer()];

  return {
    register(renderer: PartRenderer): Disposable {
      rendererList.push(renderer);
      return {
        dispose() {
          const idx = rendererList.indexOf(renderer);
          if (idx !== -1) {
            rendererList.splice(idx, 1);
          }
        },
      };
    },
    getRendererFor(partId: string, pluginId: string, module: unknown): PartRenderer | undefined {
      // Last registered wins (higher-priority renderers registered later)
      for (let i = rendererList.length - 1; i >= 0; i--) {
        if (rendererList[i].canRender(partId, pluginId, module)) {
          return rendererList[i];
        }
      }
      return undefined;
    },
    get renderers(): readonly PartRenderer[] {
      return rendererList;
    },
  };
}
