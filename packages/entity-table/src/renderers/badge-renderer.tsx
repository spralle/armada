import { Badge } from "@ghost-shell/ui";
import { cn } from "@ghost-shell/ui";
import type { CellRendererFn } from "../cell-renderer-types.js";
import { resolveColorClass } from "./badge-colors.js";

export const badgeRenderer: CellRendererFn = (value, _row, props) => {
  if (value == null) return "—";
  const str = String(value);
  const colorMap = props?.colorMap as Record<string, string> | undefined;
  const colorClass = resolveColorClass(str, colorMap);

  return (
    <Badge variant="outline" className={cn(colorClass)}>
      {str}
    </Badge>
  );
};
