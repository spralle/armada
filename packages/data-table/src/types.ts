import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
  SortingState,
  Table,
  VisibilityState,
} from "@tanstack/react-table";
import type { ColumnMeasurer } from "./responsive/column-measurer.js";
import type { BudgetDebugInfo } from "./responsive/budget-algorithm.js";

export interface ResponsiveConfig {
  /** Enable responsive column hiding. Default: false */
  enabled?: boolean;
  /** Pluggable column measurer (e.g. pretext). Falls back to char-count heuristic. */
  measurer?: ColumnMeasurer;
  /** CSS font string for measurement. Default: '14px sans-serif' */
  font?: string;
  /** Container width below which card view is forced. Default: 480 */
  cardViewThreshold?: number;
  /** External container ref to observe. If not provided, observes an internal wrapper. */
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /** Callback with debug info on every budget recalculation */
  onBudgetChange?: (debug: BudgetDebugInfo) => void;
}

export interface GhostTableFeatures {
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enablePagination?: boolean;
  enableRowSelection?: boolean;
  enableColumnVisibility?: boolean;
  enableGlobalFilter?: boolean;
  enableColumnResizing?: boolean;
}

export interface GhostTableOptions<TData> extends GhostTableFeatures {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  pagination?: PaginationState;
  onPaginationChange?: (pagination: PaginationState) => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  initialColumnVisibility?: VisibilityState;
  initialSorting?: SortingState;
  pageSizeOptions?: number[];
  /** When true, sorting is handled externally (server-side). Disables client-side sort. */
  manualSorting?: boolean;
  /** When true, filtering is handled externally (server-side). Disables client-side filter. */
  manualFiltering?: boolean;
  /** When true, pagination is handled externally (server-side). Disables client-side pagination. */
  manualPagination?: boolean;
  /** Total row count known by server — required for server-side pagination. */
  rowCount?: number;
}

export interface GhostTableResult<TData> {
  table: Table<TData>;
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
}

export interface GhostDataTableProps<TData> {
  table: Table<TData>;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  loading?: boolean;
  loadingRows?: number;
  emptyMessage?: string;
  showToolbar?: boolean;
  showPagination?: boolean;
  pageSizeOptions?: number[];
  toolbarActions?: React.ReactNode;
  stickyHeader?: boolean;
  enableDensityToggle?: boolean;
  enableColumnFilters?: boolean;
  /** Responsive column hiding and card view configuration */
  responsive?: ResponsiveConfig;
  /** Error object — renders error state */
  error?: Error | null;
  /** Called when user clicks retry in error state */
  onRetry?: () => void;
  /** Custom error renderer (slot) */
  errorRender?: (error: Error, retry?: () => void) => React.ReactNode;
  /** When true, pagination shows approximate row count indicator */
  rowCountEstimated?: boolean;
  /** True when background refetch is in progress — shows overlay on stale data */
  isRefetching?: boolean;
}
