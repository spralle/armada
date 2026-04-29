import type { AnyRouteMap } from "../core/route-map.js";
import type { NavigationHints, NavigationTarget } from "../core/types.js";
import { createPluginRouter } from "./plugin-router.js";
import type { PluginRouter, PluginRouterService } from "./plugin-router-types.js";

/**
 * Dependencies for creating a PluginRouterService factory.
 * Injected by the shell to bridge plugin routers with tab state.
 */
export interface PluginRouterServiceDeps {
  /** Get current tab args for a given tab ID */
  readonly getTabArgs: (tabId: string) => Readonly<Record<string, string>>;
  /** Update tab args */
  readonly updateTabArgs: (tabId: string, args: Record<string, string>) => void;
  /** Subscribe to tab args changes */
  readonly subscribeTabArgs: (tabId: string, listener: (args: Readonly<Record<string, string>>) => void) => () => void;
  /** Optional navigation function */
  readonly navigate?: ((target: NavigationTarget, hints: NavigationHints) => void) | undefined;
}

/**
 * Create a PluginRouterService factory scoped to a specific tab.
 * The shell calls this once per tab mount, providing tab-specific deps.
 */
export function createPluginRouterService(tabId: string, deps: PluginRouterServiceDeps): PluginRouterService {
  return {
    createPluginRouter<T extends AnyRouteMap>(routes: T): PluginRouter<T> {
      return createPluginRouter<T>({
        routes,
        initialArgs: deps.getTabArgs(tabId),
        onArgsChange: (args) => deps.updateTabArgs(tabId, args),
        onNavigate: deps.navigate,
      });
    },
  };
}
