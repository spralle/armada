import { useState } from "react";
import { flexRender } from "@tanstack/react-table";
import type { Row, Cell } from "@tanstack/react-table";
import type { ColumnPriority } from "@ghost-shell/table-from-schema";
import { cn } from "@ghost-shell/ui";

export interface GhostCardItemProps<TData> {
  row: Row<TData>;
}

function getCellPriority<TData>(cell: Cell<TData, unknown>): ColumnPriority {
  const meta = cell.column.columnDef.meta as Record<string, unknown> | undefined;
  return (meta?.priority as ColumnPriority | undefined) ?? "default";
}

function getCellLabel<TData>(cell: Cell<TData, unknown>): string {
  const header = cell.column.columnDef.header;
  if (typeof header === "string") return header;
  return cell.column.id;
}

function partitionCells<TData>(cells: Cell<TData, unknown>[]) {
  const essential: Cell<TData, unknown>[] = [];
  const standard: Cell<TData, unknown>[] = [];
  const optional: Cell<TData, unknown>[] = [];

  for (const cell of cells) {
    const priority = getCellPriority(cell);
    if (priority === "essential") essential.push(cell);
    else if (priority === "optional") optional.push(cell);
    else standard.push(cell);
  }

  return { essential, standard, optional };
}

export function GhostCardItem<TData>({ row }: GhostCardItemProps<TData>) {
  const [expanded, setExpanded] = useState(false);
  const cells = row.getVisibleCells();
  const { essential, standard, optional } = partitionCells(cells);

  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground">
      {/* Header: essential-priority columns */}
      {essential.length > 0 && (
        <div className="space-y-1">
          {essential.map((cell, i) => (
            <div
              key={cell.id}
              className={cn(i === 0 ? "text-base font-semibold" : "text-sm")}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          ))}
        </div>
      )}

      {/* Body: default-priority columns as key-value pairs */}
      {standard.length > 0 && (
        <div className={cn("space-y-1", essential.length > 0 && "mt-3")}>
          {standard.map((cell) => (
            <div key={cell.id} className="flex items-baseline gap-2 text-sm">
              <span className="text-muted-foreground shrink-0">
                {getCellLabel(cell)}:
              </span>
              <span>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expandable: optional-priority columns */}
      {optional.length > 0 && (
        <div className="mt-3">
          {expanded && (
            <div className="mb-2 space-y-1">
              {optional.map((cell) => (
                <div key={cell.id} className="flex items-baseline gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0">
                    {getCellLabel(cell)}:
                  </span>
                  <span>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        </div>
      )}
    </div>
  );
}
