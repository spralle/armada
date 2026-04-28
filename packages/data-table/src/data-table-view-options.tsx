import type React from "react";
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

function getColumnPriority(column: Column<unknown, unknown>): string | undefined {
  const meta = column.columnDef.meta as Record<string, unknown> | undefined;
  const priority = meta?.priority;
  return typeof priority === "string" ? priority : undefined;
}

const priorityStyles: Record<string, React.CSSProperties> = {
  essential: {
    color: "oklch(0.72 0.15 155)",
    fontSize: "10px",
    lineHeight: 1,
  },
  optional: {
    color: "oklch(0.65 0.03 250)",
    fontSize: "10px",
    lineHeight: 1,
    opacity: 0.7,
  },
};

const priorityIcons: Record<string, string> = {
  essential: "★",
  optional: "○",
};

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
  /** Custom column toggle handler (for responsive mode) */
  onColumnToggle?: (columnId: string, visible: boolean) => void;
  /** Custom toggle-all handler (for responsive mode) */
  onToggleAll?: (visible: boolean) => void;
}

export function DataTableViewOptions<TData>({
  table,
  onColumnToggle,
  onToggleAll,
}: DataTableViewOptionsProps<TData>) {
  const allColumns = table
    .getAllColumns()
    .filter((col) => typeof col.accessorFn !== "undefined" && col.getCanHide());

  const allVisible = allColumns.every((col) => col.getIsVisible());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto h-8 flex">
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
            if (onToggleAll) {
              onToggleAll(!!value);
            } else {
              for (const col of allColumns) {
                col.toggleVisibility(!!value);
              }
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
            onCheckedChange={(value: boolean) => {
              if (onColumnToggle) {
                onColumnToggle(column.id, !!value);
              } else {
                column.toggleVisibility(!!value);
              }
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {getColumnLabel(column as Column<unknown, unknown>)}
              {(() => {
                const priority = getColumnPriority(column as Column<unknown, unknown>);
                if (!priority || priority === "default") return null;
                return (
                  <span style={priorityStyles[priority]}>
                    {priorityIcons[priority]}
                  </span>
                );
              })()}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
