import type { z } from "zod";
import type { ResolvedRoute } from "./define-routes.js";

/**
 * Any resolved route map (useful for generic constraints).
 */
export type AnyRouteMap = Record<string, ResolvedRoute>;

/**
 * Extract all route IDs from a route map as a union type.
 */
export type RouteId<T extends AnyRouteMap> = keyof T & string;

/**
 * Extract the params type for a specific route ID.
 */
export type RouteParams<T extends AnyRouteMap, K extends RouteId<T>> = z.infer<T[K]["schema"]>;

/**
 * A route reference that can be used for navigation — carries the route ID
 * and its inferred params type for compile-time safety.
 */
export interface RouteRef<TId extends string = string, TParams = Record<string, string>> {
  readonly id: TId;
  readonly params: TParams;
}

/**
 * Build a union of all possible RouteRef types from a route map.
 * Useful for discriminated union matching on getCurrentRoute().
 */
export type RouteRefUnion<T extends AnyRouteMap> = {
  [K in RouteId<T>]: RouteRef<K, z.infer<T[K]["schema"]>>;
}[RouteId<T>];
