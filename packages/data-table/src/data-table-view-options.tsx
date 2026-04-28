import type { Column, Table } from "@tanstack/react-table";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ghost-shell/ui";
import { SlidersHorizontal } from "lucide-react";

function getColumnLabel(column: Column<unknown, unknown>): string {
  const meta = column.columnDef.meta as Record<string, unknown> | undefined;
  if (typeof meta?.label === "string") return meta.label;
  const header = column.columnDef.header;
  if (typeof header === "string") return header;
  return column.id;
}

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
}

export function DataTableViewOptions<TData>({
  table,
}: DataTableViewOptionsProps<TData>) {
  const allColumns = table
    .getAllColumns()
    .filter((col) => typeof col.accessorFn !== "undefined" && col.getCanHide());

  const allVisible = allColumns.every((col) => col.getIsVisible());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto hidden h-8 lg:flex">
          <SlidersHorizontal />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={allVisible}
          onCheckedChange={(value: boolean) => {
            for (const col of allColumns) {
              col.toggleVisibility(!!value);
            }
          }}
        >
          Toggle all
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {allColumns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            className="capitalize"
            checked={column.getIsVisible()}
            onCheckedChange={(value: boolean) => column.toggleVisibility(!!value)}
          >
            {getColumnLabel(column as Column<unknown, unknown>)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
