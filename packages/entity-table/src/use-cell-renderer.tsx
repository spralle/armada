import { useMemo } from "react";
import type { ColumnDef, CellContext } from "@tanstack/react-table";
import type { CellRendererRegistry } from "./cell-registry.js";
import type { EntityColumnMeta } from "./column-types.js";
import { defaultCellRegistry } from "./cell-registry.js";

/**
 * Takes compiled columns and wires up cell renderers from the registry.
 * Returns new ColumnDef[] with cell functions that call the registry.
 */
export function useRenderedColumns<TData>(
  columns: ColumnDef<TData, unknown>[],
  registry: CellRendererRegistry = defaultCellRegistry,
): ColumnDef<TData, unknown>[] {
  return useMemo(() => {
    return columns.map((col) => {
      const meta = col.meta as EntityColumnMeta | undefined;
      if (!meta?.cellRenderer) return col;

      const renderer = registry.resolve(meta.cellRenderer);
      return {
        ...col,
        cell: (info: CellContext<TData, unknown>) =>
          renderer(info.getValue(), info.row.original, meta.cellProps),
      };
    });
  }, [columns, registry]);
}
