import type { NavigationHints, NavigationTarget } from "../core/types.js";
import type { AnyRouteMap, RouteId, RouteParams, RouteRefUnion } from "../core/route-map.js";

/**
 * Scoped router instance for a plugin — provides compile-time type-safe
 * navigation within a plugin's own route definitions.
 *
 * @example
 * ```ts
 * import { defineRoutes } from "@ghost-shell/router";
 * import { z } from "zod";
 *
 * const routes = defineRoutes({
 *   "vessel.list": { params: z.object({ filter: z.string().optional() }) },
 *   "vessel.detail": { params: z.object({ vesselId: z.string() }) },
 * });
 *
 * // In plugin mount:
 * function mount(target: HTMLElement, ctx: PluginMountContext) {
 *   const router = ctx.router as PluginRouter<typeof routes>;
 *
 *   // Type-safe navigation:
 *   router.navigate("vessel.detail", { vesselId: "v123" });          // ✅
 *   router.navigate("vessel.detail", {});                             // ❌ compile error
 *   router.navigate("vessel.detail", { vesselId: 123 });              // ❌ compile error
 *
 *   // Type-safe route matching:
 *   const route = router.getCurrentRoute();
 *   if (route?.id === "vessel.detail") {
 *     console.log(route.params.vesselId); // string, typed!
 *   }
 *
 *   // Subscribe to route changes:
 *   const unsub = router.subscribe((route) => {
 *     renderView(target, route);
 *   });
 * }
 * ```
 *
 * @typeParam TRoutes - The plugin's route map created via defineRoutes()
 */
export interface PluginRouter<TRoutes extends AnyRouteMap = AnyRouteMap> {
  /**
   * Navigate to a route within this plugin's route definitions.
   * Params are type-checked at compile time against the route's Zod schema.
   */
  navigate<K extends RouteId<TRoutes>>(
    route: K,
    params: RouteParams<TRoutes, K>,
    hints?: NavigationHints,
  ): void;

  /**
   * Get the currently active route for this tab, or null if no route is active.
   * Returns a discriminated union — match on `.id` for type narrowing.
   */
  getCurrentRoute(): RouteRefUnion<TRoutes> | null;

  /**
   * Subscribe to route changes within this tab.
   * Returns an unsubscribe function.
   */
  subscribe(listener: (route: RouteRefUnion<TRoutes> | null) => void): () => void;

  /**
   * Build a NavigationTarget for use with the link behavior system.
   * The returned target can be passed to createNavigationHandler() or attachNavigation().
   */
  buildTarget<K extends RouteId<TRoutes>>(
    route: K,
    params: RouteParams<TRoutes, K>,
  ): NavigationTarget;

  /**
   * Get the raw args representation of a route (for bridging with shell APIs).
   * Serializes typed params to Record<string, string> with _route convention.
   */
  serializeRoute<K extends RouteId<TRoutes>>(
    route: K,
    params: RouteParams<TRoutes, K>,
  ): Record<string, string>;
}

/**
 * Factory for creating scoped plugin router instances.
 * Provided to plugins via GhostApi.router.
 */
export interface PluginRouterService {
  /**
   * Create a type-safe plugin router scoped to the given route definitions.
   *
   * @example
   * ```ts
   * export function activate(api: GhostApi) {
   *   const router = api.router.createPluginRouter(vesselRoutes);
   * }
   * ```
   */
  createPluginRouter<T extends AnyRouteMap>(routes: T): PluginRouter<T>;
}
