import { Input } from "@ghost-shell/ui";
import type { Column } from "@tanstack/react-table";

export function TextColumnFilter<TData>({ column }: { column: Column<TData, unknown> }) {
  return (
    <Input
      placeholder="Filter..."
      value={(column.getFilterValue() as string) ?? ""}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => column.setFilterValue(e.target.value || undefined)}
      className="h-7 w-full text-xs"
    />
  );
}
