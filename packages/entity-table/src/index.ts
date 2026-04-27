/**
 * @ghost-shell/entity-table
 *
 * Schema-driven entity table for the Ghost shell ecosystem.
 * Transforms Zod schemas into fully-configured TanStack Table instances
 * using a 3-stage pipeline: ingestSchema → compileColumns → createEntityTable.
 *
 * Built on top of @ghost-shell/data-table (headless engine layer).
 *
 * Features:
 * - Schema-to-column compilation with smart type inference
 * - Pluggable CellRendererRegistry with built-in renderers
 * - EntityList component (MRT-style config-driven)
 * - Schema annotations via .meta({ table: {} })
 */

export { compileColumns } from "./compile-columns.js";
export { humanize } from "./humanize.js";
export type {
  FilterVariant,
  EntityColumnMeta,
  EntityColumnOverride,
  CompileColumnsOptions,
} from "./column-types.js";

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

export { createEntityTable } from "./create-entity-table.js";
export { EntityList } from "./entity-list.js";
export { useRenderedColumns } from "./use-cell-renderer.js";
export type {
  EntityTableResult,
  FilterableColumnInfo,
  EntityOperation,
  OperationContext,
  EntityListProps,
} from "./entity-list-types.js";
