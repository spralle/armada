import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useGhostTable, GhostDataTable } from "@ghost-shell/data-table";
import { cn, Button } from "@ghost-shell/ui";
import { createEntityTable } from "./create-entity-table.js";
import { useRenderedColumns } from "./use-cell-renderer.js";
import { defaultCellRegistry } from "./cell-registry.js";
import { RowActionsCell } from "./row-actions-cell.js";
import { useMenuOperations } from "./use-menu-operations.js";
import type { EntityListProps } from "./entity-list-types.js";
import type { CompileTableFieldsOptions } from "@ghost-shell/table-from-schema";

/**
 * Opinionated, schema-driven entity list component.
 * Combines the full pipeline: ingestSchema → compileTableFields → toColumnDefs → useGhostTable → GhostDataTable.
 */
export function EntityList<TData>({
  entityType,
  schema,
  data,
  loading,
  overrides,
  include,
  exclude,
  defaultVisible,
  defaultSort,
  rowOperations,
  batchOperations,
  toolbarOperations,
  menuService,
  cellRegistry,
  getRowId,
  columnOverride,
  className,
  emptyMessage,
  pageSizeOptions,
  enableRowSelection,
  enableColumnResizing,
  enableStickyHeader,
  enableDensityToggle,
  enableColumnFilters,
  responsive,
    // Server-side mode
  manualSorting,
  manualFiltering,
  manualPagination,
  rowCount,
  rowCountEstimated,
  // Controlled state
  globalFilter: controlledGlobalFilter,
  onGlobalFilterChange: controlledOnGlobalFilterChange,
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
  pagination,
  onPaginationChange,
  // Async UX
  isRefetching,
  error,
  onRetry,
}: EntityListProps<TData>) {
  // 1. Schema → table config (memoized; skipped if columnOverride provided)
  const tableConfig = useMemo(() => {
    if (columnOverride) return null;
    return createEntityTable<TData>(schema, {
      include,
      exclude,
      defaultVisible,
      overrides: overrides as CompileTableFieldsOptions["overrides"],
    } as CompileTableFieldsOptions);
  }, [schema, include, exclude, defaultVisible, overrides, columnOverride]);

  // 2. Resolve columns
  const baseColumns = columnOverride ?? tableConfig!.columns;

  // 3. Wire cell renderers from registry
  const renderedColumns = useRenderedColumns(
    baseColumns,
    cellRegistry ?? defaultCellRegistry,
  );

  // 4. Append row actions column if needed
  const hasRowActions =
    (rowOperations?.length ?? 0) > 0 || menuService !== undefined;

  const finalColumns = useMemo(() => {
    if (!hasRowActions) return renderedColumns;
    const ops = rowOperations ?? [];
    const actionsColumn: ColumnDef<TData, unknown> = {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <RowActionsCell
          row={row}
          data={data}
          entityType={entityType}
          operations={ops}
          menuService={menuService}
        />
      ),
    };
    return [...renderedColumns, actionsColumn];
  }, [renderedColumns, rowOperations, data, entityType, menuService, hasRowActions]);

  // 5. Ghost table hook
  const { table, globalFilter: internalGlobalFilter, setGlobalFilter: setInternalGlobalFilter } = useGhostTable<TData>({
    data,
    columns: finalColumns,
    enableRowSelection: enableRowSelection ?? (batchOperations?.length ?? 0) > 0,
    enableColumnResizing,
    initialColumnVisibility: tableConfig?.defaultColumnVisibility,
    initialSorting: defaultSort ?? tableConfig?.defaultSorting,
    manualSorting,
    manualFiltering,
    manualPagination,
    rowCount,
    sorting,
    onSortingChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
  });

  // Resolve controlled vs internal globalFilter
  const effectiveGlobalFilter = controlledGlobalFilter ?? internalGlobalFilter;
  const effectiveOnGlobalFilterChange = controlledOnGlobalFilterChange ?? setInternalGlobalFilter;

  // 6. Resolve Ghost menu contributions for toolbar and batch
  const toolbarMenuContext = useMemo(
    () => ({ entityType }),
    [entityType],
  );
  const toolbarMenuItems = useMenuOperations(
    menuService,
    "entityTable/toolbar",
    toolbarMenuContext,
  );

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selection = useMemo(
    () => selectedRows.map((r) => r.original),
    [selectedRows],
  );

  const batchMenuContext = useMemo(
    () => ({ entityType, selection: selection as unknown[] }),
    [entityType, selection],
  );
  const batchMenuItems = useMenuOperations(
    selectedRows.length > 0 ? menuService : undefined,
    "entityTable/selection",
    batchMenuContext,
  );

  // 7. Toolbar actions (merge props + menu contributions)
  const toolbarActions = useMemo(() => {
    const actions: React.ReactNode[] = [];

    // Prop-based toolbar operations
    if (toolbarOperations?.length) {
      for (const op of toolbarOperations) {
        const ctx = { data };
        if (op.when && !op.when(ctx)) continue;
        actions.push(
          <Button
            key={op.id}
            variant={op.variant ?? "outline"}
            size="sm"
            onClick={() => op.handler(ctx)}
          >
            {op.icon}
            {op.label}
          </Button>,
        );
      }
    }

    // Ghost menu toolbar contributions (dedup against prop IDs)
    const propToolbarIds = new Set(
      (toolbarOperations ?? []).map((op) => op.id),
    );
    for (const item of toolbarMenuItems) {
      if (propToolbarIds.has(item.id)) continue;
      actions.push(
        <Button
          key={item.id}
          variant="outline"
          size="sm"
          onClick={() => item.onAction()}
        >
          {item.label}
        </Button>,
      );
    }

    // Prop-based batch operations
    if (batchOperations?.length && selectedRows.length > 0) {
      for (const op of batchOperations) {
        const ctx = { selection, data };
        if (op.when && !op.when(ctx)) continue;
        actions.push(
          <Button
            key={op.id}
            variant={op.variant ?? "default"}
            size="sm"
            onClick={() => op.handler(ctx)}
          >
            {op.icon}
            {op.label} ({selectedRows.length})
          </Button>,
        );
      }
    }

    // Ghost menu batch contributions (dedup against prop IDs)
    if (selectedRows.length > 0) {
      const propBatchIds = new Set(
        (batchOperations ?? []).map((op) => op.id),
      );
      for (const item of batchMenuItems) {
        if (propBatchIds.has(item.id)) continue;
        actions.push(
          <Button
            key={item.id}
            variant="default"
            size="sm"
            onClick={() => item.onAction()}
          >
            {item.label} ({selectedRows.length})
          </Button>,
        );
      }
    }

    return actions.length > 0 ? <>{actions}</> : undefined;
  }, [
    toolbarOperations,
    batchOperations,
    data,
    selection,
    selectedRows.length,
    toolbarMenuItems,
    batchMenuItems,
  ]);

  // 8. Render
  return (
    <div className={cn("space-y-4", className)}>
      <GhostDataTable
        table={table}
        globalFilter={effectiveGlobalFilter}
        onGlobalFilterChange={effectiveOnGlobalFilterChange}
        loading={loading}
        emptyMessage={emptyMessage}
        toolbarActions={toolbarActions}
        pageSizeOptions={pageSizeOptions}
        stickyHeader={enableStickyHeader}
        enableDensityToggle={enableDensityToggle}
        enableColumnFilters={enableColumnFilters}
        responsive={responsive}
      />
    </div>
  );
}
