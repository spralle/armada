/**
 * Vanilla DOM renderer — handles plugin modules that export plain mount functions.
 * This is the default fallback renderer for all non-framework-specific plugins.
 */

import type { PartRenderer, PartRenderContext, PartRenderHandle } from "./part-renderer.js";
import { containsReactParts } from "./define-parts.js";

/**
 * Resolve a mount function from a vanilla DOM module.
 * Supports: `mountPart(el, ctx)`, `parts.{id}.mount(el, ctx)`, `parts.{id}(el, ctx)`, `default(el, ctx)`.
 */
function resolveVanillaMountFn(
  module: unknown,
  partId: string,
): ((container: HTMLElement, context: unknown) => unknown) | undefined {
  if (typeof module !== "object" || module === null) {
    return undefined;
  }

  const record = module as Record<string, unknown>;

  if (typeof record.mountPart === "function") {
    return record.mountPart as (container: HTMLElement, context: unknown) => unknown;
  }

  const parts = record.parts;
  if (typeof parts === "object" && parts !== null) {
    const partsRecord = parts as Record<string, unknown>;
    const candidate = partsRecord[partId];
    if (typeof candidate === "function") {
      return candidate as (container: HTMLElement, context: unknown) => unknown;
    }
    if (typeof candidate === "object" && candidate !== null) {
      const mount = (candidate as Record<string, unknown>).mount;
      if (typeof mount === "function") {
        return mount as (container: HTMLElement, context: unknown) => unknown;
      }
    }
  }

  if (typeof record.default === "function") {
    return record.default as (container: HTMLElement, context: unknown) => unknown;
  }

  return undefined;
}

function normalizeToDispose(result: unknown): (() => void) | undefined {
  if (typeof result === "function") {
    return result as () => void;
  }
  if (typeof result === "object" && result !== null && "dispose" in result) {
    const disposable = result as { dispose: unknown };
    if (typeof disposable.dispose === "function") {
      return () => (disposable.dispose as () => void)();
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
