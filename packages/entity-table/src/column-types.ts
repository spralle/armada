import type { SchemaFieldType } from "@ghost-shell/formr-from-schema";

/** Filter variant hints stored in column meta */
export type FilterVariant =
  | "text"
  | "number"
  | "range"
  | "select"
  | "multiSelect"
  | "boolean"
  | "date";

/** Metadata stored in TanStack ColumnDef.meta */
export interface EntityColumnMeta {
  filterVariant?: FilterVariant;
  filterOptions?: readonly unknown[];
  filterMin?: number;
  filterMax?: number;
  cellRenderer?: string;
  cellProps?: Record<string, unknown>;
  headerTooltip?: string;
  fieldType?: SchemaFieldType;
  pinned?: "left" | "right" | false;
}

/** Per-column overrides provided by the consumer */
export interface EntityColumnOverride {
  label?: string;
  cell?: string;
  cellProps?: Record<string, unknown>;
  pinned?: "left" | "right" | false;
  sortable?: boolean;
  filterable?: boolean;
  filterVariant?: FilterVariant;
  hidden?: boolean;
  width?: number | string;
}

/** Options for compileColumns */
export interface CompileColumnsOptions<TData> {
  /** Only include these fields as columns (by path) */
  include?: string[];
  /** Exclude these fields from columns (by path) */
  exclude?: string[];
  /** Fields visible by default (others hidden but toggleable) */
  defaultVisible?: string[];
  /** Per-field overrides keyed by field path */
  overrides?: Partial<Record<keyof TData & string, EntityColumnOverride>>;
}
