import type { ColumnDef } from "@tanstack/react-table";
import type { SchemaFieldInfo, SchemaFieldMetadata } from "@ghost-shell/formr-from-schema";
import type {
  CompileColumnsOptions,
  EntityColumnMeta,
  EntityColumnOverride,
  FilterVariant,
} from "./column-types.js";
import { humanize } from "./humanize.js";

/**
 * Compile an array of schema fields into TanStack ColumnDef[] with smart
 * defaults derived from field types, metadata, and consumer overrides.
 *
 * This is a pure function — no React, no side effects.
 */
export function compileColumns<TData>(
  fields: readonly SchemaFieldInfo[],
  options?: CompileColumnsOptions<TData>,
): ColumnDef<TData, unknown>[] {
  const filtered = filterFields(fields, options);
  const overrides = (options?.overrides ?? {}) as Record<string, EntityColumnOverride>;
  const defaultVisible = options?.defaultVisible;

  return filtered.map((field) => {
    const override = overrides[field.path] as EntityColumnOverride | undefined;
    const annotation = readTableAnnotation(field.metadata);
    const derived = deriveFromType(field);

    const meta = buildMeta(field, derived, annotation, override);
    const header = resolveHeader(field, override, annotation);
    const sortable = resolveSortable(field, override);

    const col: ColumnDef<TData, unknown> = {
      id: field.path,
      accessorKey: field.path,
      header,
      enableSorting: sortable,
      enableColumnFilter: override?.filterable ?? true,
      meta,
    };

    if (typeof override?.width === "number") {
      col.size = override.width;
    }

    return col;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DerivedColumnConfig {
  filterVariant: FilterVariant;
  cellRenderer: string;
  filterOptions?: readonly unknown[];
  filterMin?: number;
  filterMax?: number;
}

/** Table-specific annotations from metadata.extra.table */
interface TableAnnotation {
  label?: string;
  cell?: string;
  cellProps?: Record<string, unknown>;
  pinned?: "left" | "right" | false;
  sortable?: boolean;
  filterable?: boolean;
  filterVariant?: FilterVariant;
  hidden?: boolean;
}

function filterFields(
  fields: readonly SchemaFieldInfo[],
  options?: CompileColumnsOptions<unknown>,
): readonly SchemaFieldInfo[] {
  let result = fields;
  if (options?.include) {
    const set = new Set(options.include);
    result = result.filter((f) => set.has(f.path));
  }
  if (options?.exclude) {
    const set = new Set(options.exclude);
    result = result.filter((f) => !set.has(f.path));
  }
  return result;
}

function readTableAnnotation(
  metadata: SchemaFieldMetadata | undefined,
): TableAnnotation | undefined {
  const extra = metadata?.extra;
  if (!extra || typeof extra !== "object") return undefined;
  const table = (extra as Record<string, unknown>)["table"];
  if (!table || typeof table !== "object") return undefined;
  return table as TableAnnotation;
}

function deriveFromType(field: SchemaFieldInfo): DerivedColumnConfig {
  const meta = field.metadata;
  const format = meta?.format;

  switch (field.type) {
    case "string":
      if (format === "email" || format === "url") {
        return { filterVariant: "text", cellRenderer: "link" };
      }
      return { filterVariant: "text", cellRenderer: "text" };

    case "enum":
      return deriveEnum(meta);

    case "number":
    case "integer":
      return deriveNumber(meta);

    case "boolean":
      return { filterVariant: "boolean", cellRenderer: "boolean" };

    case "date":
      return { filterVariant: "date", cellRenderer: "date" };

    case "datetime":
      return { filterVariant: "date", cellRenderer: "datetime" };

    case "array":
      return { filterVariant: "multiSelect", cellRenderer: "tags" };

    default:
      return { filterVariant: "text", cellRenderer: "text" };
  }
}

function deriveEnum(meta: SchemaFieldMetadata | undefined): DerivedColumnConfig {
  const options = meta?.enum;
  const cellRenderer = options && options.length <= 8 ? "badge" : "text";
  return {
    filterVariant: "select",
    cellRenderer,
    filterOptions: options,
  };
}

function deriveNumber(meta: SchemaFieldMetadata | undefined): DerivedColumnConfig {
  const hasRange = meta?.minimum != null && meta?.maximum != null;
  if (hasRange) {
    return {
      filterVariant: "range",
      cellRenderer: "text",
      filterMin: meta!.minimum,
      filterMax: meta!.maximum,
    };
  }
  return { filterVariant: "number", cellRenderer: "text" };
}

function buildMeta(
  field: SchemaFieldInfo,
  derived: DerivedColumnConfig,
  annotation: TableAnnotation | undefined,
  override: EntityColumnOverride | undefined,
): EntityColumnMeta {
  return {
    fieldType: field.type,
    headerTooltip: field.metadata?.description,
    filterVariant: override?.filterVariant ?? annotation?.filterVariant ?? derived.filterVariant,
    filterOptions: derived.filterOptions,
    filterMin: derived.filterMin,
    filterMax: derived.filterMax,
    cellRenderer: override?.cell ?? annotation?.cell ?? derived.cellRenderer,
    cellProps: override?.cellProps ?? annotation?.cellProps,
    pinned: override?.pinned ?? annotation?.pinned,
  };
}

function resolveHeader(
  field: SchemaFieldInfo,
  override: EntityColumnOverride | undefined,
  annotation: TableAnnotation | undefined,
): string {
  return (
    override?.label ??
    annotation?.label ??
    field.metadata?.label ??
    field.metadata?.title ??
    humanize(field.path)
  );
}

function resolveSortable(
  field: SchemaFieldInfo,
  override: EntityColumnOverride | undefined,
): boolean {
  if (override?.sortable != null) return override.sortable;
  if (field.type === "array" || field.type === "object") return false;
  return true;
}
