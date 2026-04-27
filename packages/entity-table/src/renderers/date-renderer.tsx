import type { CellRendererFn } from "../cell-renderer-types.js";

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export const dateRenderer: CellRendererFn = (value, _row, props) => {
  if (value == null) return "—";
  const d = parseDate(value);
  if (!d) return "—";
  const locale = (props?.locale as string) ?? "en-US";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
};

export const datetimeRenderer: CellRendererFn = (value, _row, props) => {
  if (value == null) return "—";
  const d = parseDate(value);
  if (!d) return "—";
  const locale = (props?.locale as string) ?? "en-US";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(d);
};
