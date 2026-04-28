import type { Column } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ghost-shell/ui";

export function SelectColumnFilter<TData>({ column }: { column: Column<TData, unknown> }) {
  const meta = column.columnDef.meta as Record<string, unknown> | undefined;
  const options = (meta?.filterOptions as readonly unknown[]) ?? [];

  return (
    <Select
      value={(column.getFilterValue() as string) ?? "__all__"}
      onValueChange={(v: string) => column.setFilterValue(v === "__all__" ? undefined : v)}
    >
      <SelectTrigger className="h-7 w-full text-xs">
        <SelectValue placeholder="All" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All</SelectItem>
        {options.map((opt) => (
          <SelectItem key={String(opt)} value={String(opt)}>
            {String(opt)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
