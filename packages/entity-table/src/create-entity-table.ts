import type { SortingState, VisibilityState } from "@tanstack/react-table";
import { ingestSchema } from "@ghost-shell/formr-from-schema";
import { compileColumns } from "./compile-columns.js";
import type { CompileColumnsOptions, EntityColumnMeta } from "./column-types.js";
import type {
  EntityTableResult,
  FilterableColumnInfo,
} from "./entity-list-types.js";

/**
 * Creates the full entity table configuration from a schema.
 * Pure function — no React, no side effects.
 * Mirrors the createSchemaForm pattern from formr-from-schema.
 */
export function createEntityTable<TData>(
  schema: unknown,
  options?: CompileColumnsOptions<TData>,
): EntityTableResult<TData> {
  const { fields, metadata } = ingestSchema(schema);
  const columns = compileColumns<TData>(fields, options);

  const defaultColumnVisibility = deriveVisibility(columns, options);
  const defaultSorting: SortingState = [];
  const searchableFields = deriveSearchableFields(columns);
  const filterableColumns = deriveFilterableColumns(columns);

  return {
    columns,
    defaultColumnVisibility,
    defaultSorting,
    searchableFields,
    filterableColumns,
    metadata,
  };
}

/** Build visibility state: hidden columns or those not in defaultVisible → false */
function deriveVisibility(
  columns: { id?: string; meta?: unknown }[],
  options?: CompileColumnsOptions<unknown>,
): VisibilityState {
  const visibility: VisibilityState = {};
  const defaultVisible = options?.defaultVisible
    ? new Set(options.defaultVisible)
    : undefined;

  for (const col of columns) {
    const id = col.id;
    if (!id) continue;
    const meta = col.meta as EntityColumnMeta | undefined;
    if (meta?.pinned === false) {
      // explicitly unpinned, not hidden
    }
    if (defaultVisible && !defaultVisible.has(id)) {
      visibility[id] = false;
    }
  }
  return visibility;
}

/** String and enum fields are searchable via global filter */
function deriveSearchableFields(
  columns: { id?: string; meta?: unknown }[],
): string[] {
  const result: string[] = [];
  for (const col of columns) {
    if (!col.id) continue;
    const meta = col.meta as EntityColumnMeta | undefined;
    const ft = meta?.fieldType;
    if (ft === "string" || ft === "enum") {
      result.push(col.id);
    }
  }
  return result;
}

/** Extract filterable column info from column meta */
function deriveFilterableColumns(
  columns: { id?: string; meta?: unknown }[],
): FilterableColumnInfo[] {
  const result: FilterableColumnInfo[] = [];
  for (const col of columns) {
    if (!col.id) continue;
    const meta = col.meta as EntityColumnMeta | undefined;
    if (!meta?.filterVariant) continue;
    result.push({
      id: col.id,
      variant: meta.filterVariant,
      options: meta.filterOptions,
      min: meta.filterMin,
      max: meta.filterMax,
    });
  }
  return result;
}
