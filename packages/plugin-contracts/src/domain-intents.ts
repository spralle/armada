/**
 * Shared domain intent type constants.
 *
 * Intent types use a `domain.entity.<verb>` naming convention.
 * Plugins declare actions with these intent types and `predicate` predicates
 * to participate in polymorphic resolution.
 *
 * @example
 * ```ts
 * // In a plugin contract:
 * {
 *   id: "my-plugin.open-order",
 *   title: "Open Order",
 *   intent: INTENT_ENTITY_OPEN,
 *   predicate: { entityType: { $eq: "order" } }
 * }
 * ```
 */

/** Open an entity viewer for the resolved entity type */
export const INTENT_ENTITY_OPEN = "domain.entity.open" as const;

/** Inspect/show details for the resolved entity type */
export const INTENT_ENTITY_INSPECT = "domain.entity.inspect" as const;

/** Assign entities to each other (e.g. order to vessel) */
export const INTENT_ENTITY_ASSIGN = "domain.entity.assign" as const;
