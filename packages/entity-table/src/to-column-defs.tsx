import type { ColumnDef, FilterFn } from '@tanstack/react-table';
import type { TableFieldDescriptor } from '@ghost-shell/table-from-schema';
import { DataTableColumnHeader, inNumberRange } from '@ghost-shell/data-table';

/** EntityColumnMeta stored in ColumnDef.meta — kept for backward compat */
export interface EntityColumnMeta {
  readonly fieldType?: string;
  readonly headerTooltip?: string;
  readonly filterVariant?: string;
  readonly filterOptions?: readonly unknown[];
  readonly filterMin?: number;
  readonly filterMax?: number;
  readonly cellRenderer?: string;
  readonly cellProps?: Record<string, unknown>;
  readonly pinned?: 'left' | 'right' | false;
  readonly hasExplicitWidth?: boolean;
  readonly label?: string;
  readonly priority?: 'essential' | 'default' | 'optional';
  readonly minWidth?: number;
  readonly wrap?: boolean;
}

/**
 * Bridge: maps framework-agnostic TableFieldDescriptor[] to TanStack ColumnDef[].
 */
export function toColumnDefs<TData>(
  fields: readonly TableFieldDescriptor[],
): ColumnDef<TData, unknown>[] {
  return fields.map((desc) => {
    const meta: EntityColumnMeta = {
      fieldType: desc.type,
      headerTooltip: desc.headerTooltip,
      filterVariant: desc.filter,
      filterOptions: desc.options,
      filterMin: desc.filterMin,
      filterMax: desc.filterMax,
      cellRenderer: desc.format,
      cellProps: desc.formatOptions as Record<string, unknown> | undefined,
      pinned: desc.pinned,
      hasExplicitWidth: desc.width !== undefined,
      label: desc.label,
      priority: desc.priority,
      minWidth: desc.minWidth,
      wrap: desc.wrap,
    };

    const col: ColumnDef<TData, unknown> = {
      id: desc.field,
      accessorKey: desc.field,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={desc.label} />
      ),
      enableSorting: desc.sortable,
      enableColumnFilter: desc.filter !== undefined,
      meta,
    };

    if (desc.filter === 'range') {
      col.filterFn = inNumberRange as FilterFn<TData>;
    }

    if (typeof desc.width === 'number') {
      col.size = desc.width;
    }

    return col;
  });
}
