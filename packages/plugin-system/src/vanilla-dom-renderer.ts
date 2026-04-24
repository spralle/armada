/**
 * Vanilla DOM renderer — handles plugin modules that export plain mount functions.
 * This is the default fallback renderer for all non-framework-specific plugins.
 */

import type { PartRenderer, PartRenderContext, PartRenderHandle } from "@ghost-shell/contracts/parts";
import { containsReactParts, resolveModuleMountFn } from "@ghost-shell/contracts/parts";

/**
 * Resolve a mount function from a vanilla DOM module using the generic resolver.
 */
function resolveVanillaMountFn(
  module: unknown,
  partId: string,
): ((container: HTMLElement, context: unknown) => unknown) | undefined {
  return resolveModuleMountFn(module, {
    topLevelNames: ["mountPart"],
    collectionName: "parts",
    collectionKeys: [partId],
    checkDefault: true,
  }) as ((container: HTMLElement, context: unknown) => unknown) | undefined;
}

/** Normalize a mount result into a dispose function. Checks for function, .dispose, and .unmount. */
function normalizeToDispose(result: unknown): (() => void) | undefined {
  if (typeof result === "function") {
    return result as () => void;
  }
  if (typeof result === "object" && result !== null) {
    const record = result as Record<string, unknown>;
    if (typeof record.dispose === "function") {
      return () => (record.dispose as () => void)();
    }
    if (typeof record.unmount === "function") {
      return () => (record.unmount as () => void)();
    }
  }
  return undefined;
}

export function createVanillaDomRenderer(): PartRenderer {
  return {
    id: "vanilla-dom",

    canRender(partId: string, _pluginId: string, module: unknown): boolean {
      if (containsReactParts(module)) {
        return false;
      }
      return resolveVanillaMountFn(module, partId) !== undefined;
    },

    mount(context: PartRenderContext): PartRenderHandle {
      const mountFn = resolveVanillaMountFn(context.module, context.partId);
      if (!mountFn) {
        return { dispose() {} };
      }

      let disposed = false;
      let cleanupFn: (() => void) | undefined;

      const result = mountFn(context.container, context.mountContext);

      if (result instanceof Promise) {
        result.then((resolved) => {
          const fn = normalizeToDispose(resolved);
          if (disposed) {
            fn?.();
          } else {
            cleanupFn = fn;
          }
        }).catch((err: unknown) => {
          console.warn(`[vanilla-dom-renderer] async mount failed for part '${context.partId}'`, err);
        });
      } else {
        cleanupFn = normalizeToDispose(result);
      }

      return {
        dispose() {
          disposed = true;
          if (cleanupFn) {
            try {
              cleanupFn();
            } catch (err: unknown) {
              console.warn(`[vanilla-dom-renderer] cleanup failed for part '${context.partId}'`, err);
            }
          }
        },
      };
    },
  };
}
