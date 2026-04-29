import type { Column } from "@tanstack/react-table";
import type { ComponentType } from "react";
import { RangeColumnFilter } from "./range-filter.js";
import { SelectColumnFilter } from "./select-filter.js";
import { TextColumnFilter } from "./text-filter.js";

export { inNumberRange, RangeColumnFilter } from "./range-filter.js";
export { SelectColumnFilter } from "./select-filter.js";
export { TextColumnFilter } from "./text-filter.js";

/** Column filter props shared by all filter components. */
export interface ColumnFilterProps<TData> {
  column: Column<TData, unknown>;
}

/** Resolves the appropriate filter component for a given filter variant. */
export function resolveColumnFilter<TData>(
  filterVariant: string | undefined,
): ComponentType<ColumnFilterProps<TData>> | undefined {
  switch (filterVariant) {
    case "text":
    case "number":
      return TextColumnFilter;
    case "select":
    case "boolean":
    case "multiSelect":
      return SelectColumnFilter;
    case "range":
      return RangeColumnFilter;
    default:
      return undefined;
  }
}
