import type { z } from "zod";
import type { NavigationHints, NavigationTarget } from "../core/types.js";
import type { AnyRouteMap } from "../core/route-map.js";
import type { PluginRouter } from "./plugin-router-types.js";

/**
 * Options for creating a scoped plugin router instance.
 */
export interface CreatePluginRouterOptions {
  /** The route definitions from defineRoutes() */
  readonly routes: AnyRouteMap;
  /** Current tab's args (read from PluginMountContext) */
  readonly initialArgs: Readonly<Record<string, string>>;
  /** Callback to write args changes to the shell (updates ContextTab.args) */
  readonly onArgsChange: (args: Record<string, string>) => void;
  /** Optional navigation dispatch for building targets */
  readonly onNavigate?: ((target: NavigationTarget, hints: NavigationHints) => void) | undefined;
}

const ROUTE_KEY = "_route";

/**
 * Look up a route definition, throwing a descriptive error if not found.
 */
function getRouteDef(routes: AnyRouteMap, route: string): AnyRouteMap[string] {
  const def = routes[route];
  if (!def) {
    throw new Error(`[PluginRouter] Unknown route: "${route}". Available routes: ${Object.keys(routes).join(", ")}`);
  }
  return def;
}

/**
 * Serialize typed params to a flat string record with _route convention.
 * Zod ensures type correctness; we just stringify values for shell transport.
 */
function serializeParams(
  routeId: string,
  params: Record<string, unknown>,
  schema: z.ZodType,
): Record<string, string> {
  const parsed = schema.parse(params) as Record<string, unknown>;
  const result: Record<string, string> = { [ROUTE_KEY]: routeId };
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  }
  return result;
}

/**
 * Create a scoped PluginRouter instance for type-safe navigation
 * within a plugin's own route definitions.
 */
export function createPluginRouter<T extends AnyRouteMap>(
  options: CreatePluginRouterOptions,
): PluginRouter<T> {
  const { routes, onArgsChange, onNavigate } = options;
  let currentArgs: Readonly<Record<string, string>> = options.initialArgs;
  const listeners = new Set<(route: unknown) => void>();

  function notifyListeners(): void {
    const route = getCurrentRoute();
    for (const listener of listeners) {
      listener(route);
    }
  }

  function updateArgs(args: Record<string, string>): void {
    currentArgs = args;
    onArgsChange(args);
    notifyListeners();
  }

  function getCurrentRoute(): { readonly id: string; readonly params: unknown } | null {
    const routeId = currentArgs[ROUTE_KEY];
    if (!routeId) return null;

    const routeDef = routes[routeId];
    if (!routeDef) return null;

    const argsWithoutRoute: Record<string, string> = {};
    for (const [key, value] of Object.entries(currentArgs)) {
      if (key !== ROUTE_KEY) {
        argsWithoutRoute[key] = value;
      }
    }

    const result = routeDef.schema.safeParse(argsWithoutRoute);
    if (!result.success) {
      console.warn(
        `[PluginRouter] Failed to parse params for route "${routeId}":`,
        result.error.issues,
      );
      return null;
    }

    return { id: routeId, params: result.data };
  }

  const router: PluginRouter<T> = {
    navigate(route, params, hints) {
      const routeDef = getRouteDef(routes, route as string);
      const serialized = serializeParams(route as string, params as Record<string, unknown>, routeDef.schema);
      updateArgs(serialized);
      if (onNavigate) {
        onNavigate({ route: route as string, params: serialized }, hints ?? {});
      }
    },

    getCurrentRoute() {
      return getCurrentRoute() as ReturnType<PluginRouter<T>["getCurrentRoute"]>;
    },

    subscribe(listener) {
      listeners.add(listener as (route: unknown) => void);
      return () => { listeners.delete(listener as (route: unknown) => void); };
    },

    buildTarget(route, params) {
      const routeDef = getRouteDef(routes, route as string);
      const serialized = serializeParams(route as string, params as Record<string, unknown>, routeDef.schema);
      return { route: route as string, params: serialized };
    },

    serializeRoute(route, params) {
      const routeDef = getRouteDef(routes, route as string);
      return serializeParams(route as string, params as Record<string, unknown>, routeDef.schema);
    },
  };

  return router;
}
