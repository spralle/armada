import type {
  PartRenderer,
  PartRenderContext,
  PartRenderHandle,
  PluginMountContext,
  ReactPartsModule,
} from "@ghost-shell/contracts";
import { isReactPartsModule } from "@ghost-shell/contracts";
import { createElement, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { GhostContext, type GhostContextValue } from "./ghost-context.js";

/**
 * Find a ReactPartsModule in a loaded MF module.
 * Checks the module itself first, then iterates named exports.
 * MF exposes return the file's exports as an object, so the Symbol
 * lives on a named export (e.g. `module.parts`), not the module itself.
 */
export function findReactPartsModule(module: unknown): ReactPartsModule | undefined {
  if (isReactPartsModule(module)) {
    return module;
  }
  if (typeof module !== "object" || module === null) {
    return undefined;
  }
  for (const value of Object.values(module as Record<string, unknown>)) {
    if (isReactPartsModule(value)) {
      return value;
    }
  }
  return undefined;
}

/**
 * Create a PartRenderer that mounts React components from ReactPartsModule.
 *
 * The renderer wraps each component in a GhostProvider so that plugin
 * components can access shell services and context via hooks.
 */
export function createReactPartRenderer(): PartRenderer {
  return {
    id: "react",

    canRender(_partId: string, _pluginId: string, module: unknown): boolean {
      return findReactPartsModule(module) !== undefined;
    },

    mount(context: PartRenderContext): PartRenderHandle {
      const reactModule = findReactPartsModule(context.module);
      if (!reactModule) {
        console.warn(
          `[react-renderer] No ReactPartsModule found for plugin '${context.pluginId}'`,
        );
        return { dispose() {} };
      }

      const Component = reactModule.components[context.partId] as
        | ComponentType<{ readonly context: PluginMountContext }>
        | undefined;

      if (!Component) {
        console.warn(
          `[react-renderer] No component found for part '${context.partId}' in plugin '${context.pluginId}'`,
        );
        return { dispose() {} };
      }

      const root = createRoot(context.container);
      const ghostValue: GhostContextValue = {
        pluginId: context.pluginId,
        partId: context.partId,
        mountContext: context.mountContext,
      };

      root.render(
        createElement(
          GhostContext.Provider,
          { value: ghostValue },
          createElement(Component, { context: context.mountContext }),
        ),
      );

      return {
        dispose() {
          root.unmount();
        },
      };
    },
  };
}
