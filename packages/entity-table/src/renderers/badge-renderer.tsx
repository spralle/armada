import { Badge } from "@ghost-shell/ui";
import type { CellRendererFn } from "../cell-renderer-types.js";

export const badgeRenderer: CellRendererFn = (value, _row, props) => {
  if (value == null) return "—";
  const variant = (props?.variant as "default" | "secondary" | "destructive" | "outline") ?? "secondary";
  return <Badge variant={variant}>{String(value)}</Badge>;
};
