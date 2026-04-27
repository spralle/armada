import { Badge } from "@ghost-shell/ui";
import type { CellRendererFn } from "../cell-renderer-types.js";

export const tagsRenderer: CellRendererFn = (value, _row, props) => {
  if (value == null) return "—";
  const items = Array.isArray(value) ? value : [value];
  if (items.length === 0) return "—";
  const maxTags = (props?.maxTags as number) ?? 5;
  const visible = items.slice(0, maxTags);
  const remaining = items.length - visible.length;
  return (
    <span className="flex flex-wrap gap-1">
      {visible.map((item, i) => (
        <Badge key={i} variant="secondary">{String(item)}</Badge>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-muted-foreground">+{remaining} more</span>
      )}
    </span>
  );
};
