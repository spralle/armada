import { useState } from "react";
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
import type { GhostDataTableProps } from "./types.js";

export function GhostDataTable<TData>({
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
}: GhostDataTableProps<TData>) {
  const columnCount = table.getAllColumns().length;
  const [showFilters, setShowFilters] = useState(false);
  const isResizable = !!table.options.enableColumnResizing;

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
              const hasExplicitWidth = !!(header.column.columnDef.meta as Record<string, unknown>)?.hasExplicitWidth;
              const widthStyle = isResizable || hasExplicitWidth ? { width: header.getSize() } : undefined;
              return (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  style={{ ...widthStyle, position: isResizable ? "relative" : undefined }}
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
                const hasExplicitWidth = !!(cell.column.columnDef.meta as Record<string, unknown>)?.hasExplicitWidth;
                const widthStyle = isResizable || hasExplicitWidth ? { width: cell.column.getSize() } : undefined;
                return (
                  <TableCell
                    key={cell.id}
                    style={widthStyle}
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

  return (
    <div className="space-y-4">
      {showToolbar && (
        <DataTableToolbar
          table={table}
          globalFilter={globalFilter}
          onGlobalFilterChange={onGlobalFilterChange}
          toolbarActions={combinedToolbarActions}
        />
      )}
      <div className={cn("rounded-md border", stickyHeader && "max-h-[500px] overflow-auto")}>
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
      {showPagination && (
        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
      )}
    </div>
  );
}
