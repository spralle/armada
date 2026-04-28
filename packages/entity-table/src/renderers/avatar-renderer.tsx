import { Avatar, AvatarFallback, AvatarImage } from "@ghost-shell/ui";
import type { CellRendererFn } from "../cell-renderer-types.js";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export const avatarRenderer: CellRendererFn = (value, _row, props) => {
  if (value == null) return "—";
  const label = String(value);
  const src = props?.src as string | undefined;
  return (
    <span className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        {src && <AvatarImage src={src} alt={label} />}
        <AvatarFallback className="text-xs">{getInitials(label)}</AvatarFallback>
      </Avatar>
      <span>{label}</span>
    </span>
  );
};
