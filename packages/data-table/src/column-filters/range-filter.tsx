import { Input } from "@ghost-shell/ui";
import type { Column, FilterFn } from "@tanstack/react-table";

type RangeValue = [number | undefined, number | undefined];

/** Custom filter function for range (min/max) filtering on numeric columns. */
export const inNumberRange: FilterFn<unknown> = (row, columnId, filterValue) => {
  const val = row.getValue(columnId) as number;
  const [min, max] = (filterValue as RangeValue) ?? [];
  if (min != null && val < min) return false;
  if (max != null && val > max) return false;
  return true;
};

export function RangeColumnFilter<TData>({ column }: { column: Column<TData, unknown> }) {
  const filterValue = (column.getFilterValue() as RangeValue | undefined) ?? [undefined, undefined];
  const meta = column.columnDef.meta as Record<string, unknown> | undefined;
  const min = meta?.filterMin as number | undefined;
  const max = meta?.filterMax as number | undefined;

  return (
    <div className="flex gap-1">
      <Input
        type="number"
        placeholder={min != null ? String(min) : "Min"}
        value={filterValue[0] ?? ""}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const val = e.target.value ? Number(e.target.value) : undefined;
          column.setFilterValue([val, filterValue[1]]);
        }}
        className="h-7 w-full text-xs"
      />
      <Input
        type="number"
        placeholder={max != null ? String(max) : "Max"}
        value={filterValue[1] ?? ""}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const val = e.target.value ? Number(e.target.value) : undefined;
          column.setFilterValue([filterValue[0], val]);
        }}
        className="h-7 w-full text-xs"
      />
    </div>
  );
}
