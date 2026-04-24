import type { z } from "zod";

/**
 * A single route definition with a Zod schema for params.
 */
export interface RouteDefinition<TParams extends z.ZodType = z.ZodType> {
  /** Zod schema for route params — drives both type inference and runtime validation. */
  readonly params: TParams;
}

/**
 * Input shape for defineRoutes — a record of route IDs to definitions.
 */
export type RouteDefinitionMap = Record<string, RouteDefinition>;

/**
 * A resolved route entry with its ID, inferred param type, and schema reference.
 */
export interface ResolvedRoute<TId extends string = string, TParams extends z.ZodType = z.ZodType> {
  /** The route identifier. */
  readonly id: TId;
  /** The Zod schema for runtime validation. */
  readonly schema: TParams;
}

/**
 * Maps route definition input to resolved routes with inferred types.
 * This is the main type-level utility — it preserves route IDs as literal types
 * and infers param types from Zod schemas.
 */
export type TypedRouteMap<T extends RouteDefinitionMap> = {
  readonly [K in keyof T & string]: ResolvedRoute<K, T[K]["params"]>;
};

/**
 * Extract the inferred param type for a route.
 */
export type InferRouteParams<T extends ResolvedRoute> = z.infer<T["schema"]>;

/**
 * Define a set of type-safe routes with Zod-validated params.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { defineRoutes } from "@ghost-shell/router";
 *
 * const routes = defineRoutes({
 *   "vessel.list": {
 *     params: z.object({ filter: z.string().optional() }),
 *   },
 *   "vessel.detail": {
 *     params: z.object({ vesselId: z.string() }),
 *   },
 *   "vessel.edit": {
 *     params: z.object({
 *       vesselId: z.string(),
 *       mode: z.enum(["basic", "advanced"]).default("basic"),
 *     }),
 *   },
 * });
 *
 * // Type-safe access:
 * routes["vessel.detail"].id;     // "vessel.detail" (literal type)
 * routes["vessel.detail"].schema; // z.ZodObject<{ vesselId: z.ZodString }>
 *
 * // Use with PluginRouter for type-safe navigation:
 * // router.navigate(routes["vessel.detail"], { vesselId: "v123" }); ✅
 * // router.navigate(routes["vessel.detail"], {});                   ❌ compile error
 * ```
 */
export function defineRoutes<T extends RouteDefinitionMap>(definitions: T): TypedRouteMap<T> {
  const result = {} as Record<string, ResolvedRoute>;
  for (const [id, def] of Object.entries(definitions)) {
    result[id] = { id, schema: def.params };
  }
  return result as TypedRouteMap<T>;
}
