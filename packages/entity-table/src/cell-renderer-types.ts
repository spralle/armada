import type { ReactNode } from "react";

/**
 * A cell renderer function. Receives the cell value, the full row data,
 * and optional props from column configuration.
 */
export type CellRendererFn<TValue = unknown> = (
  value: TValue,
  row: unknown,
  props?: Record<string, unknown>,
) => ReactNode;
