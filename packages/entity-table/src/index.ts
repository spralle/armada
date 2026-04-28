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

// Re-exports from table-from-schema for convenience
export { compileTableFields, createTableConfig, humanize } from '@ghost-shell/table-from-schema';
export type {
  TableFieldDescriptor,
  TableConfig,
  FilterVariant,
  FilterableFieldInfo,
  TableFieldOverride,
  CompileTableFieldsOptions,
  CreateTableConfigOptions,
} from '@ghost-shell/table-from-schema';

// Bridge layer
export { toColumnDefs, type EntityColumnMeta } from './to-column-defs.js';

// Cell renderer system
export { CellRendererRegistry, defaultCellRegistry } from "./cell-registry.js";
export type { CellRendererFn } from "./cell-renderer-types.js";
export { registerBuiltins } from "./renderers/index.js";
export {
  textRenderer,
  badgeRenderer,
  currencyRenderer,
  dateRenderer,
  datetimeRenderer,
  booleanRenderer,
  linkRenderer,
  tagsRenderer,
  avatarRenderer,
} from "./renderers/index.js";

// Entity table pipeline
export { createEntityTable } from "./create-entity-table.js";
export { EntityList } from "./entity-list.js";
export { RowActionsCell } from "./row-actions-cell.js";
export { useMenuOperations } from "./use-menu-operations.js";
export type { MenuOperationItem } from "./use-menu-operations.js";
export { useRenderedColumns } from "./use-cell-renderer.js";
export type {
  EntityTableResult,
  FilterableColumnInfo as FilterableColumnInfoLegacy,
  EntityOperation,
  OperationContext,
  EntityListProps,
} from "./entity-list-types.js";
