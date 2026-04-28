import type { CellRendererFn } from "../cell-renderer-types.js";

export const textRenderer: CellRendererFn = (value) => {
  if (value == null) return "—";
  return String(value);
};
