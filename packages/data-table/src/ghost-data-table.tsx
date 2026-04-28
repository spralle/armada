import type React from "react";
import { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import { flexRender } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Skeleton,
  Button,
  cn,
} from "@ghost-shell/ui";
import { Filter } from "lucide-react";
import { DataTablePagination } from "./data-table-pagination.js";
import { DataTableToolbar } from "./data-table-toolbar.js";
import { resolveColumnFilter } from "./column-filters/index.js";
import { useResponsiveColumns } from "./responsive/use-responsive-columns.js";
import { GhostCardList } from "./card-view/ghost-card-list.js";
import type { ColumnPriority } from "./responsive/budget-algorithm.js";
import type { GhostDataTableProps } from "./types.js";

function GhostDataTableImpl<TData>({
  table,
  globalFilter,
  onGlobalFilterChange,
  loading = false,
  loadingRows = 5,
  emptyMessage = "No results.",
  showToolbar = true,
  showPagination = true,
  pageSizeOptions,
  toolbarActions,
  stickyHeader = false,
  enableColumnFilters = false,
  responsive,
  error,
  onRetry,
  errorRender,
  isRefetching = false,
  rowCountEstimated,
  cardIndicator,
}: GhostDataTableProps<TData>) {
  const columnCount = table.getAllColumns().length;
  const [showFilters, setShowFilters] = useState(false);
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({});
  const latestBudgetVisRef = useRef<Record<string, boolean>>({});
  const isResizable = !!table.options.enableColumnResizing;

  // --- Responsive column hiding ---
  // Stable string key: column IDs don't change during table lifetime,
  // avoids busting memos on every render (getAllColumns() returns new arrays).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps on columnIdKey (derived string) instead of getAllColumns() array identity
  const columnIdKey = table.getAllColumns().map(c => c.id).join(',')

  // Stable key for user-hidden columns so memo updates when overrides change
  const userHiddenKey = Object.entries(userOverrides)
    .filter(([, v]) => v === false)
    .map(([k]) => k)
    .sort()
    .join(',')

  const responsiveColumns = useMemo(() =>
    table.getAllColumns()
      .filter(col => userOverrides[col.id] !== false)
      .map(col => ({
        id: col.id,
        priority: ((col.columnDef.meta as Record<string, unknown>)?.priority as ColumnPriority) ?? "default",
        label: ((col.columnDef.meta as Record<string, unknown>)?.label as string) ?? col.id,
        minWidth: (col.columnDef.meta as Record<string, unknown>)?.minWidth as number | undefined,
        format: ((col.columnDef.meta as Record<string, unknown>)?.cellRenderer as string | undefined)
          ?? ((col.columnDef.meta as Record<string, unknown>)?.format as string | undefined),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable string keys instead of array/object identity
    [columnIdKey, userHiddenKey, table],
  );

  const formatMap = useMemo(() => {
    const map: Record<string, string | undefined> = {}
    for (const col of table.getAllColumns()) {
      map[col.id] = ((col.columnDef.meta as Record<string, unknown>)?.cellRenderer as string | undefined)
        ?? ((col.columnDef.meta as Record<string, unknown>)?.format as string | undefined)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps on columnIdKey (derived string) instead of getAllColumns() array identity
  }, [columnIdKey, table])

  const getCellValue = useCallback((row: TData, columnId: string): string => {
    const value = (row as Record<string, unknown>)[columnId];
    if (value == null) return "—"

    if (value instanceof Date) {
      return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    if (typeof value === 'boolean') {
      return value ? "Yes" : "No"
    }
    const format = formatMap[columnId]
    if (format === 'currency' && typeof value === 'number') {
      return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    }
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    return String(value);
  }, [formatMap]);

  // Use row count as stability proxy — getCoreRowModel().rows is a new array each render.
  // Measurement assumes data is immutable-per-fetch; in-place row edits won't trigger
  // re-measurement. Acceptable because responsive measurement is a layout heuristic.
  const rowCount = table.getCoreRowModel().rows.length
  const responsiveData = useMemo(
    () => table.getCoreRowModel().rows.map(r => r.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps on rowCount (derived number) instead of rows array identity
    [rowCount, table],
  )

  const handleVisibilityChange = useCallback((vis: Record<string, boolean>) => {
    latestBudgetVisRef.current = vis
    const merged = { ...vis, ...userOverrides }
    table.setColumnVisibility(merged)
  }, [table, userOverrides])

  // When userOverrides change, re-merge with latest budget result
  useEffect(() => {
    if (!responsive?.enabled) return
    const budget = latestBudgetVisRef.current
    if (Object.keys(budget).length === 0) return
    const merged = { ...budget, ...userOverrides }
    table.setColumnVisibility(merged)
  }, [userOverrides, responsive?.enabled, table])

  const handleUserColumnToggle = useCallback((columnId: string, visible: boolean) => {
    setUserOverrides(prev => ({ ...prev, [columnId]: visible }))
    table.setColumnVisibility(prev => ({ ...prev, [columnId]: visible }))
  }, [table])

  const handleUserToggleAll = useCallback((visible: boolean) => {
    const allCols = table.getAllColumns()
      .filter(col => typeof col.accessorFn !== 'undefined' && col.getCanHide())
    const overrides: Record<string, boolean> = {}
    for (const col of allCols) {
      overrides[col.id] = visible
    }
    setUserOverrides(prev => ({ ...prev, ...overrides }))
    table.setColumnVisibility(prev => ({ ...prev, ...overrides }))
  }, [table])

  const responsiveResult = useResponsiveColumns({
    columns: responsiveColumns,
    data: responsiveData,
    getCellValue,
    measurer: responsive?.measurer,
    font: responsive?.font,
    enabled: responsive?.enabled ?? false,
    cardViewThreshold: responsive?.cardViewThreshold,
    containerRef: responsive?.containerRef,
    onVisibilityChange: handleVisibilityChange,
    onBudgetChange: responsive?.onBudgetChange,
  });

  const filterToggle = enableColumnFilters ? (
    <Button
      variant={showFilters ? "secondary" : "ghost"}
      size="sm"
      onClick={() => setShowFilters((prev) => !prev)}
      className="h-8"
    >
      <Filter className="mr-1 h-4 w-4" />
      Filter
    </Button>
  ) : null;

  const combinedToolbarActions = (filterToggle || toolbarActions) ? (
    <>
      {toolbarActions}
      {filterToggle}
    </>
  ) : undefined;

  const tableContent = (
    <>
      <TableHeader className={cn(stickyHeader && "sticky top-0 z-10 bg-background shadow-[0_1px_0_0_var(--border)]")}>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const meta = header.column.columnDef.meta as Record<string, unknown> | undefined;
              const hasExplicitWidth = !!meta?.hasExplicitWidth;
              const headerMinWidth = meta?.minWidth as number | undefined;
              const widthStyle = isResizable || hasExplicitWidth ? { width: header.getSize() } : undefined;
              return (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  style={{ ...widthStyle, position: isResizable ? "relative" : undefined, minWidth: headerMinWidth ? `${headerMinWidth}px` : undefined }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {isResizable && header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={cn(
                        "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
                        header.column.getIsResizing() ? "bg-primary" : "hover:bg-primary/50",
                      )}
                    />
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
        {showFilters && (
          <TableRow>
            {table.getHeaderGroups()[0]?.headers.map((header) => {
              const meta = header.column.columnDef.meta as Record<string, unknown> | undefined;
              const filterVariant = meta?.filterVariant as string | undefined;
              const FilterComponent = header.column.getCanFilter()
                ? resolveColumnFilter<TData>(filterVariant)
                : undefined;
              return (
                <TableHead key={`filter-${header.id}`} className="p-1">
                  {FilterComponent ? <FilterComponent column={header.column} /> : null}
                </TableHead>
              );
            })}
          </TableRow>
        )}
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: loadingRows }).map((_, i) => (
            <TableRow key={`skeleton-${i}`}>
              {Array.from({ length: columnCount }).map((_, j) => (
                <TableCell key={`skeleton-${i}-${j}`}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : table.getRowModel().rows.length > 0 ? (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? "selected" : undefined}
            >
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta as Record<string, unknown> | undefined;
                const hasExplicitWidth = !!meta?.hasExplicitWidth;
                const wrap = meta?.wrap as boolean | undefined;
                const cellMinWidth = meta?.minWidth as number | undefined;
                const widthStyle = isResizable || hasExplicitWidth ? { width: cell.column.getSize() } : undefined;
                return (
                  <TableCell
                    key={cell.id}
                    style={{ ...widthStyle, minWidth: cellMinWidth ? `${cellMinWidth}px` : undefined }}
                    className={cn(!wrap && "whitespace-nowrap", wrap && "break-words")}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columnCount} className="h-24 text-center">
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </>
  );

  const hasData = table.getRowModel().rows.length > 0;
  const hasError = !!error;

  const errorCard = hasError && !hasData ? (
    errorRender ? errorRender(error, onRetry) : (
      <div className="flex flex-col items-center justify-center rounded-md border p-8 text-center">
        <div className="text-destructive mb-2 text-sm font-medium">
          {error.message || "An error occurred"}
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    )
  ) : null;

  const errorBanner = hasError && hasData ? (
    errorRender ? errorRender(error, onRetry) : (
      <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <span>{error.message || "An error occurred"}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="ml-auto h-7">
            Retry
          </Button>
        )}
      </div>
    )
  ) : null;

  return (
    <div className="space-y-4">
      {showToolbar && (
        <DataTableToolbar
          table={table}
          globalFilter={globalFilter}
          onGlobalFilterChange={onGlobalFilterChange}
          toolbarActions={combinedToolbarActions}
          onColumnToggle={responsive?.enabled ? handleUserColumnToggle : undefined}
          onToggleAll={responsive?.enabled ? handleUserToggleAll : undefined}
        />
      )}
      {errorBanner}
      {errorCard ? errorCard : (
      <div ref={responsive?.enabled && !responsive?.containerRef ? responsiveResult.containerRef as React.RefObject<HTMLDivElement> : undefined}>
        {responsiveResult.shouldUseCardView ? (
          <GhostCardList table={table} emptyMessage={emptyMessage} loading={loading} loadingRows={loadingRows} cardIndicator={cardIndicator} />
        ) : (
          <div className="relative">
          {isRefetching && !loading && (
            <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden rounded-t-md">
              <div className="h-full w-full animate-pulse bg-primary/40" />
            </div>
          )}
          <div className={cn("rounded-md border", stickyHeader && "max-h-[500px] overflow-auto", isRefetching && !loading && "opacity-60 pointer-events-none")}>
            {stickyHeader ? (
              <table className={cn("min-w-full caption-bottom text-sm", isResizable && "table-fixed")}>
                {tableContent}
              </table>
            ) : (
              <Table className={cn("min-w-full", isResizable && "table-fixed")}>
                {tableContent}
              </Table>
            )}
          </div>
          </div>
        )}
      </div>
      )}
      {showPagination && (
        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} rowCountEstimated={rowCountEstimated} />
      )}
    </div>
  );
}

// Memoize to prevent parent re-renders from cascading into the table.
// Cast preserves the generic type parameter that memo() would erase.
export const GhostDataTable = memo(GhostDataTableImpl) as <TData>(
  props: GhostDataTableProps<TData>,
) => React.ReactElement | null
