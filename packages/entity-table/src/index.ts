/**
 * @ghost-shell/entity-table
 *
 * Schema-driven entity table for the Ghost shell ecosystem.
 * Transforms Zod schemas into fully-configured TanStack Table instances
 * using a pipeline: schema → table-from-schema → toColumnDefs → TanStack.
 *
 * Built on top of @ghost-shell/data-table (headless engine layer)
 * and @ghost-shell/table-from-schema (framework-agnostic field compilation).
 *
 * Features:
 * - Schema-to-column compilation with smart type inference
 * - Pluggable CellRendererRegistry with built-in renderers
 * - EntityList component (MRT-style config-driven)
 * - Schema annotations via .meta({ table: {} })
 */

export type { BudgetColumnDebug, BudgetDebugInfo, ResponsiveConfig } from "@ghost-shell/data-table";
export type {
  CompileTableFieldsOptions,
  CreateTableConfigOptions,
  FilterableFieldInfo,
  FilterVariant,
  TableConfig,
  TableFieldDescriptor,
  TableFieldOverride,
} from "@ghost-shell/table-from-schema";
// Re-exports from table-from-schema for convenience
export { compileTableFields, createTableConfig, humanize } from "@ghost-shell/table-from-schema";

// Cell renderer system
export { CellRendererRegistry, defaultCellRegistry } from "./cell-registry.js";
export type { CellRendererFn } from "./cell-renderer-types.js";
// Entity table pipeline
export { createEntityTable } from "./create-entity-table.js";
export type { CardIndicatorResult, CardSlot, EntityCardListProps } from "./entity-card-list.js";
// EntityCardList — standalone card rendering from schema+data
export { EntityCardList } from "./entity-card-list.js";
export { EntityList } from "./entity-list.js";
export type {
  EntityListProps,
  EntityOperation,
  EntityTableResult,
  FilterableColumnInfo as FilterableColumnInfoLegacy,
  OperationContext,
} from "./entity-list-types.js";
export {
  avatarRenderer,
  badgeRenderer,
  booleanRenderer,
  currencyRenderer,
  dateRenderer,
  datetimeRenderer,
  linkRenderer,
  registerBuiltins,
  tagsRenderer,
  textRenderer,
} from "./renderers/index.js";
// Responsive — pretext measurer (optional, tree-shakeable)
export { createPretextMeasurer } from "./responsive/index.js";
export type { ResponsiveEntityProps } from "./responsive-entity.js";
// ResponsiveEntity — auto-switches between table and card view
export { ResponsiveEntity } from "./responsive-entity.js";
export { RowActionsCell } from "./row-actions-cell.js";
// Bridge layer
export { type EntityColumnMeta, toColumnDefs } from "./to-column-defs.js";
export { useRenderedColumns } from "./use-cell-renderer.js";
export type { MenuOperationItem } from "./use-menu-operations.js";
export { useMenuOperations } from "./use-menu-operations.js";
