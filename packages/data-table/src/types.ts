import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
  SortingState,
  Table,
  VisibilityState,
} from "@tanstack/react-table";

export interface GhostTableFeatures {
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enablePagination?: boolean;
  enableRowSelection?: boolean;
  enableColumnVisibility?: boolean;
  enableGlobalFilter?: boolean;
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
}
