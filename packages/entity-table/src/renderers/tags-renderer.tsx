import { Badge } from "@ghost-shell/ui";
import { cn } from "@ghost-shell/ui";
import type { CellRendererFn } from "../cell-renderer-types.js";
import { resolveColorClass } from "./badge-colors.js";

export const tagsRenderer: CellRendererFn = (value, _row, props) => {
  if (value == null) return "—";
  const items = Array.isArray(value) ? value : [value];
  if (items.length === 0) return "—";
  const maxTags = (props?.maxTags as number) ?? 5;
  const colorMap = props?.colorMap as Record<string, string> | undefined;
  const visible = items.slice(0, maxTags);
  const remaining = items.length - visible.length;
  return (
    <span className="flex flex-wrap gap-1">
      {visible.map((item, i) => {
        const str = String(item);
        const colorClass = resolveColorClass(str, colorMap);
        return (
          <Badge key={i} variant="outline" className={cn(colorClass)}>
            {str}
          </Badge>
        );
      })}
      {remaining > 0 && (
        <span className="text-xs text-muted-foreground">+{remaining} more</span>
      )}
    </span>
  );
};
