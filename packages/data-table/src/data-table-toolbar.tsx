import type { Table } from "@tanstack/react-table";
import { Button, Input } from "@ghost-shell/ui";
import { Search, X } from "lucide-react";
import { DataTableViewOptions } from "./data-table-view-options.js";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  toolbarActions?: React.ReactNode;
  trailingActions?: React.ReactNode;
}

export function DataTableToolbar<TData>({
  table,
  globalFilter,
  onGlobalFilterChange,
  toolbarActions,
  trailingActions,
}: DataTableToolbarProps<TData>) {
  const isFiltered =
    table.getState().columnFilters.length > 0 || (globalFilter && globalFilter.length > 0);

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        {onGlobalFilterChange && (
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={globalFilter ?? ""}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => onGlobalFilterChange(event.target.value)}
              className="h-8 w-[150px] pl-8 lg:w-[250px]"
            />
          </div>
        )}
        {toolbarActions}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
              onGlobalFilterChange?.("");
            }}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center space-x-2">
        {trailingActions}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
