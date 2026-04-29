import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Table,
  VisibilityState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useDebouncedValue } from "./use-debounced-value.js";
import { useGhostTable } from "./use-ghost-table.js";

export interface UseServerTableOptions<TData> {
  /** Current page of data from server */
  data: TData[];
  /** Column definitions */
  columns: ColumnDef<TData, unknown>[];
  /** Total row count from server */
  rowCount?: number;

  // Controlled state (consumer manages via query params/state)
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  pagination: PaginationState;
  onPaginationChange: (pagination: PaginationState) => void;

  // Optional features
  enableRowSelection?: boolean;
  initialColumnVisibility?: VisibilityState;
  /** Debounce ms for search input. Default: 300 */
  searchDebounceMs?: number;
}

export interface UseServerTableResult<TData> {
  /** TanStack table instance */
  table: Table<TData>;
  /** Immediate search value (for input display) */
  searchValue: string;
  /** Update search input */
  setSearchValue: (value: string) => void;
  /** Debounced search value (use in query keys) */
  debouncedSearch: string;
  /** Current table state for query key derivation */
  tableState: {
    sorting: SortingState;
    columnFilters: ColumnFiltersState;
    pagination: PaginationState;
    search: string;
  };
}

export function useServerTable<TData>(options: UseServerTableOptions<TData>): UseServerTableResult<TData> {
  const {
    data,
    columns,
    rowCount,
    sorting,
    onSortingChange,
    columnFilters = [],
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    enableRowSelection = false,
    initialColumnVisibility,
    searchDebounceMs = 300,
  } = options;

  // Internal search state with debouncing
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, searchDebounceMs);

  const { table } = useGhostTable({
    data,
    columns,
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    rowCount,
    sorting,
    onSortingChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    enableRowSelection,
    initialColumnVisibility,
    enableGlobalFilter: false,
  });

  // Stable table state object for query key derivation
  const tableState = useMemo(
    () => ({
      sorting,
      columnFilters,
      pagination,
      search: debouncedSearch,
    }),
    [sorting, columnFilters, pagination, debouncedSearch],
  );

  return {
    table,
    searchValue,
    setSearchValue,
    debouncedSearch,
    tableState,
  };
}
