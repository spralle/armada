import { cn } from "@ghost-shell/ui";
import { CheckCircle2, XCircle } from "lucide-react";
import type { CellRendererFn } from "../cell-renderer-types.js";

export const booleanRenderer: CellRendererFn = (value) => {
  if (value == null) return "—";
  return value ? (
    <CheckCircle2 className={cn("h-4 w-4 text-green-600")} />
  ) : (
    <XCircle className={cn("h-4 w-4 text-muted-foreground")} />
  );
};
