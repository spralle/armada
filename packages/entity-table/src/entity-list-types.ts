import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import type { SchemaMetadata } from "@ghost-shell/table-from-schema";
import type { FilterVariant } from "@ghost-shell/table-from-schema";
import type { CellRendererRegistry } from "./cell-registry.js";
import type { ReactNode } from "react";
import type { MenuService } from "@ghost-shell/contracts";

/** Result from createEntityTable — all config needed to render */
export interface EntityTableResult<TData> {
  columns: ColumnDef<TData, unknown>[];
  defaultColumnVisibility: VisibilityState;
  defaultSorting: SortingState;
  searchableFields: string[];
  filterableColumns: FilterableColumnInfo[];
  metadata: SchemaMetadata;
}

export interface FilterableColumnInfo {
  id: string;
  variant: FilterVariant;
  options?: readonly unknown[];
  min?: number;
  max?: number;
}

/** Operation definition (props-based, Phase 1 — no Ghost menus yet) */
export interface EntityOperation<TData = unknown> {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  /** Called when the operation is triggered */
  handler: (context: OperationContext<TData>) => void | Promise<void>;
  /** Optional predicate — hide if returns false */
  when?: (context: OperationContext<TData>) => boolean;
  /** For ordering */
  order?: number;
}

export interface OperationContext<TData> {
  /** The entity for row operations */
  entity?: TData;
  /** Selected entities for batch operations */
  selection?: TData[];
  /** All data */
  data: TData[];
}

/** Props for <EntityList> */
export interface EntityListProps<TData> {
  /** Entity type identifier */
  entityType: string;
  /** Schema (Zod, JSON Schema, or Standard Schema) */
  schema: unknown;
  /** Table data */
  data: TData[];
  /** Loading state */
  loading?: boolean;
  /** Per-column overrides by field path */
  overrides?: Partial<Record<string, import("@ghost-shell/table-from-schema").TableFieldOverride>>;
  /** Only include these fields */
  include?: string[];
  /** Exclude these fields */
  exclude?: string[];
  /** Default visible columns */
  defaultVisible?: string[];
  /** Default sort */
  defaultSort?: SortingState;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Operations for individual rows (shown in row actions dropdown) */
  rowOperations?: EntityOperation<TData>[];
  /** Operations for batch selection (shown when rows selected) */
  batchOperations?: EntityOperation<TData>[];
  /** Operations for toolbar (always visible) */
  toolbarOperations?: EntityOperation<TData>[];
  /** Custom cell renderer registry (defaults to global defaultCellRegistry) */
  cellRegistry?: CellRendererRegistry;
  /** Get unique row ID */
  getRowId?: (row: TData) => string;
  /** Full escape hatch — bypass schema pipeline with custom columns */
  columnOverride?: ColumnDef<TData, unknown>[];
  /** Additional className */
  className?: string;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Page size options */
  pageSizeOptions?: number[];
  /** Enable row selection */
  enableRowSelection?: boolean;
  /** Enable column resizing */
  enableColumnResizing?: boolean;
  /** Enable sticky header with scrollable container */
  enableStickyHeader?: boolean;
  /** Enable density toggle in toolbar */
  enableDensityToggle?: boolean;
  /** Enable per-column filter UI */
  enableColumnFilters?: boolean;
  /** Responsive column hiding and card view configuration */
  responsive?: import("@ghost-shell/data-table").ResponsiveConfig;
  /** Optional Ghost menu service for contributed operations */
  menuService?: MenuService;

  // --- Server-side mode ---
  /** When true, sorting is handled externally (server-side) */
  manualSorting?: boolean;
  /** When true, filtering is handled externally (server-side) */
  manualFiltering?: boolean;
  /** When true, pagination is handled externally (server-side) */
  manualPagination?: boolean;
  /** Total row count known by server — required for server-side pagination */
  rowCount?: number;
  /** Whether rowCount is an estimate (for UI display hints) */
  rowCountEstimated?: boolean;

  // --- Controlled state ---
  /** Controlled global filter value (for server-side search) */
  globalFilter?: string;
  /** Called when search input changes (for server-side search) */
  onGlobalFilterChange?: (value: string) => void;
  /** Controlled sorting state */
  sorting?: SortingState;
  /** Callback when sorting changes */
  onSortingChange?: (sorting: SortingState) => void;
  /** Controlled column filters state */
  columnFilters?: ColumnFiltersState;
  /** Callback when column filters change */
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  /** Controlled pagination state */
  pagination?: PaginationState;
  /** Callback when pagination changes */
  onPaginationChange?: (pagination: PaginationState) => void;

  // --- Async UX ---
  /** Whether data is being refetched (shows subtle loading indicator) */
  isRefetching?: boolean;
  /** Error from data fetching */
  error?: Error | null;
  /** Retry callback for error recovery */
  onRetry?: () => void;
}
