import type { CellRendererFn } from "../cell-renderer-types.js";

export const currencyRenderer: CellRendererFn = (value, _row, props) => {
  if (value == null) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  const currency = (props?.currency as string) ?? "USD";
  const locale = (props?.locale as string) ?? "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(num);
};
