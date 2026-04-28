import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type PaginationState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { Checkbox } from "@ghost-shell/ui";
import type { GhostTableOptions, GhostTableResult } from "./types.js";

const DEFAULT_PAGE_SIZE = 20;

function makeSelectionColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value: boolean | "indeterminate") => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value: boolean | "indeterminate") => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  };
}

export function useGhostTable<TData>(
  options: GhostTableOptions<TData>,
): GhostTableResult<TData> {
  const {
    data,
    columns,
    enableSorting = true,
    enableFiltering = true,
    enablePagination = true,
    enableRowSelection = false,
    enableColumnVisibility = true,
    enableGlobalFilter = true,
    manualSorting = false,
    manualFiltering = false,
    manualPagination = false,
    rowCount,
  } = options;

  const [internalSorting, setInternalSorting] = useState<SortingState>(options.initialSorting ?? []);
  const [internalFilters, setInternalFilters] = useState<ColumnFiltersState>([]);
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const [internalVisibility, setInternalVisibility] = useState<VisibilityState>(options.initialColumnVisibility ?? {});
  const [globalFilter, setGlobalFilter] = useState("");

  const allColumns = useMemo(() => {
    if (enableRowSelection) {
      return [makeSelectionColumn<TData>(), ...columns];
    }
    return columns;
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    ...(enableSorting && !manualSorting && { getSortedRowModel: getSortedRowModel() }),
    ...(enableFiltering && !manualFiltering && { getFilteredRowModel: getFilteredRowModel() }),
    ...(enablePagination && !manualPagination && { getPaginationRowModel: getPaginationRowModel() }),
    ...(manualPagination && rowCount !== undefined && { rowCount }),
    manualSorting,
    manualFiltering,
    manualPagination,
    enableSorting,
    enableColumnFilters: enableFiltering,
    enableRowSelection,
    enableHiding: enableColumnVisibility,
    enableGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      sorting: options.sorting ?? internalSorting,
      columnFilters: options.columnFilters ?? internalFilters,
      pagination: options.pagination ?? internalPagination,
      rowSelection: options.rowSelection ?? internalRowSelection,
      columnVisibility: options.columnVisibility ?? internalVisibility,
      globalFilter,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function"
        ? updater(options.sorting ?? internalSorting)
        : updater;
      options.onSortingChange ? options.onSortingChange(next) : setInternalSorting(next);
    },
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === "function"
        ? updater(options.columnFilters ?? internalFilters)
        : updater;
      options.onColumnFiltersChange ? options.onColumnFiltersChange(next) : setInternalFilters(next);
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function"
        ? updater(options.pagination ?? internalPagination)
        : updater;
      options.onPaginationChange ? options.onPaginationChange(next) : setInternalPagination(next);
    },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function"
        ? updater(options.rowSelection ?? internalRowSelection)
        : updater;
      options.onRowSelectionChange ? options.onRowSelectionChange(next) : setInternalRowSelection(next);
    },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function"
        ? updater(options.columnVisibility ?? internalVisibility)
        : updater;
      options.onColumnVisibilityChange ? options.onColumnVisibilityChange(next) : setInternalVisibility(next);
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  return { table, globalFilter, setGlobalFilter };
}
