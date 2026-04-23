import type {
  PartRenderer,
  PartRenderContext,
  PartRenderHandle,
  ReactPartsModule,
} from "@ghost-shell/contracts";
import { isReactPartsModule } from "@ghost-shell/contracts";
import { createElement, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { GhostContext, type GhostContextValue } from "./ghost-context.js";

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
      return isReactPartsModule(module);
    },

    mount(context: PartRenderContext): PartRenderHandle {
      const reactModule = context.module as ReactPartsModule;
      const Component = reactModule.components[context.partId] as
        | ComponentType<{ readonly context: PartRenderContext }>
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
          createElement(Component, { context }),
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
