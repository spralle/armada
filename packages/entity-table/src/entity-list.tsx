import { useMemo } from "react";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { useGhostTable, GhostDataTable } from "@ghost-shell/data-table";
import {
  cn,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ghost-shell/ui";
import { MoreHorizontal } from "lucide-react";
import { createEntityTable } from "./create-entity-table.js";
import { useRenderedColumns } from "./use-cell-renderer.js";
import { defaultCellRegistry } from "./cell-registry.js";
import type { EntityListProps, EntityOperation } from "./entity-list-types.js";
import type { CompileColumnsOptions } from "./column-types.js";

/**
 * Opinionated, schema-driven entity list component.
 * Combines the full pipeline: ingestSchema → compileColumns → useGhostTable → GhostDataTable.
 */
export function EntityList<TData>({
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
  cellRegistry,
  getRowId,
  columnOverride,
  className,
  emptyMessage,
  pageSizeOptions,
  enableRowSelection,
}: EntityListProps<TData>) {
  // 1. Schema → table config (memoized; skipped if columnOverride provided)
  const tableConfig = useMemo(() => {
    if (columnOverride) return null;
    return createEntityTable<TData>(schema, {
      include,
      exclude,
      defaultVisible,
      overrides: overrides as CompileColumnsOptions<TData>["overrides"],
    });
  }, [schema, include, exclude, defaultVisible, overrides, columnOverride]);

  // 2. Resolve columns
  const baseColumns = columnOverride ?? tableConfig!.columns;

  // 3. Wire cell renderers from registry
  const renderedColumns = useRenderedColumns(
    baseColumns,
    cellRegistry ?? defaultCellRegistry,
  );

  // 4. Append row actions column if needed
  const finalColumns = useMemo(() => {
    if (!rowOperations?.length) return renderedColumns;
    return [...renderedColumns, makeRowActionsColumn<TData>(rowOperations, data)];
  }, [renderedColumns, rowOperations, data]);

  // 5. Ghost table hook
  const { table, globalFilter, setGlobalFilter } = useGhostTable<TData>({
    data,
    columns: finalColumns,
    enableRowSelection: enableRowSelection ?? (batchOperations?.length ?? 0) > 0,
    columnVisibility: tableConfig?.defaultColumnVisibility,
    sorting: defaultSort ?? tableConfig?.defaultSorting,
  });

  // 6. Toolbar actions
  const toolbarActions = useMemo(() => {
    const actions: React.ReactNode[] = [];

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

    if (batchOperations?.length) {
      const selectedRows = table.getFilteredSelectedRowModel().rows;
      if (selectedRows.length > 0) {
        const selection = selectedRows.map((r) => r.original);
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
    }

    return actions.length > 0 ? <>{actions}</> : undefined;
  }, [toolbarOperations, batchOperations, data, table]);

  // 7. Render
  return (
    <div className={cn("space-y-4", className)}>
      <GhostDataTable
        table={table}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        loading={loading}
        emptyMessage={emptyMessage}
        toolbarActions={toolbarActions}
        pageSizeOptions={pageSizeOptions}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRowActionsColumn<TData>(
  operations: EntityOperation<TData>[],
  data: TData[],
): ColumnDef<TData, unknown> {
  const sorted = [...operations].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  return {
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }: { row: Row<TData> }) => {
      const entity = row.original;
      const ctx = { entity, data };
      const visible = sorted.filter((op) => !op.when || op.when(ctx));
      if (visible.length === 0) return null;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {visible.map((op) => (
              <DropdownMenuItem key={op.id} onClick={() => op.handler(ctx)}>
                {op.icon}
                {op.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  };
}
