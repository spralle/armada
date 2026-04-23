import type {
  ContextContributionRegistry,
  PartRenderer,
  PartRenderContext,
  PartRenderHandle,
  PluginMountContext,
  ReactPartsModule,
} from "@ghost-shell/contracts";
import { isReactPartsModule, findReactPartsModule } from "@ghost-shell/contracts";
import { createElement, type ComponentType, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { GhostContext, type GhostContextValue } from "./ghost-context.js";

/**
 * Create a PartRenderer that mounts React components from ReactPartsModule.
 *
 * The renderer wraps each component in a GhostProvider so that plugin
 * components can access shell services and context via hooks.
 */
/**
 * Build the React element tree for a plugin part, wrapping with
 * GhostContext and contributed providers (lowest order = outermost).
 */
function buildRenderTree(
  Component: ComponentType<{ readonly context: PluginMountContext }>,
  ghostValue: GhostContextValue,
  registry: ContextContributionRegistry | undefined,
): ReactElement {
  const providers = registry?.getProviders() ?? [];

  let tree: ReactElement = createElement(Component, {
    context: ghostValue.mountContext,
  });
  tree = createElement(GhostContext.Provider, { value: ghostValue }, tree);

  // Wrap with contributed providers: lowest order = outermost,
  // so iterate in reverse (highest order wraps first, ends up innermost).
  for (let i = providers.length - 1; i >= 0; i--) {
    const P = providers[i].Provider as ComponentType<{ readonly children: ReactElement }>;
    tree = createElement(P, null, tree);
  }

  return tree;
}

export function createReactPartRenderer(
  registry?: ContextContributionRegistry,
): PartRenderer {
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

      const ghostValue: GhostContextValue = {
        pluginId: context.pluginId,
        partId: context.partId,
        mountContext: context.mountContext,
        ...(registry ? { contextRegistry: registry } : {}),
      };

      const root = createRoot(context.container);
      root.render(buildRenderTree(Component, ghostValue, registry));

      const providerSub = registry?.subscribeProviders(() => {
        root.render(buildRenderTree(Component, ghostValue, registry));
      });

      return {
        dispose() {
          providerSub?.dispose();
          root.unmount();
        },
      };
    },
  };
}
