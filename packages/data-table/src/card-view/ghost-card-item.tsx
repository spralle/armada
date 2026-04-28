import { useState } from "react";
import { flexRender } from "@tanstack/react-table";
import type { Row, Cell } from "@tanstack/react-table";
import type { ColumnPriority } from "@ghost-shell/table-from-schema";
import { cn } from "@ghost-shell/ui";

export type CardSlot = "header" | "leading" | "body" | "trailing" | "footer";

export interface CardIndicatorResult {
  /** CSS color value (hex, rgb, oklch, etc.) */
  color: string;
  /** Which edge to show the indicator. Default: 'left' */
  edge?: "left" | "right";
  /** Width in pixels. Default: 4 */
  width?: number;
}

export interface GhostCardItemProps<TData> {
  row: Row<TData>;
  indicator?: CardIndicatorResult | null;
}

function getSlot<TData>(cell: Cell<TData, unknown>): CardSlot | "optional" {
  const meta = cell.column.columnDef.meta as Record<string, unknown> | undefined;

  // Explicit slot wins
  const explicitSlot = meta?.cardSlot as CardSlot | undefined;
  if (explicitSlot) return explicitSlot;

  // Infer from priority
  const priority = (meta?.priority as ColumnPriority | undefined) ?? "default";
  if (priority === "optional") return "optional";
  if (priority === "essential") return "header";

  // Infer from format
  const format = (meta?.cellRenderer as string) ?? (meta?.format as string);
  if (format === "avatar") return "leading";
  if (format === "currency") return "trailing";
  if (format === "tags" || format === "badge") return "footer";

  return "body";
}

function getCellLabel<TData>(cell: Cell<TData, unknown>): string {
  const meta = cell.column.columnDef.meta as Record<string, unknown> | undefined;
  const label = meta?.label as string | undefined;
  if (label) return label;
  const header = cell.column.columnDef.header;
  if (typeof header === "string") return header;
  return cell.column.id;
}

type SlotMap<TData> = Record<CardSlot | "optional", Cell<TData, unknown>[]>;

function partitionBySlot<TData>(cells: Cell<TData, unknown>[]): SlotMap<TData> {
  const slots: SlotMap<TData> = {
    header: [],
    leading: [],
    body: [],
    trailing: [],
    footer: [],
    optional: [],
  };
  for (const cell of cells) {
    slots[getSlot(cell)].push(cell);
  }
  return slots;
}

export function GhostCardItem<TData>({ row, indicator }: GhostCardItemProps<TData>) {
  const [expanded, setExpanded] = useState(false);
  const slots = partitionBySlot(row.getVisibleCells());
  const isRight = indicator?.edge === "right";

  return (
    <div className="relative overflow-hidden rounded-lg border bg-card text-card-foreground">
      {/* Status indicator strip */}
      {indicator && (
        <div
          className={cn("absolute top-0 bottom-0", isRight ? "right-0" : "left-0")}
          style={{
            width: `${indicator.width ?? 4}px`,
            backgroundColor: indicator.color,
          }}
        />
      )}

      {/* Card content */}
      <div
        className={cn(
          "p-4",
          indicator && !isRight && "pl-5",
          indicator && isRight && "pr-5",
        )}
      >
        {/* Main layout: leading | center | trailing */}
        <div className="flex gap-3">
          {/* Leading dock */}
          {slots.leading.length > 0 && (
            <div className="flex shrink-0 items-start">
              {slots.leading.map((cell) => (
                <div key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          )}

          {/* Center: header + body */}
          <div className="min-w-0 flex-1">
            {slots.header.length > 0 && (
              <div className="space-y-0.5">
                {slots.header.map((cell, i) => (
                  <div
                    key={cell.id}
                    className={cn(
                      i === 0
                        ? "text-base font-semibold leading-tight"
                        : "text-sm text-muted-foreground",
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            )}

            {/* Body slot: 2-column grid of key-value pairs */}
            {slots.body.length > 0 && (
              <div
                className={cn(
                  "grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2",
                  slots.header.length > 0 && "mt-2",
                )}
              >
                {slots.body.map((cell) => (
                  <div key={cell.id} className="flex items-baseline gap-1.5 text-sm">
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {getCellLabel(cell)}
                    </span>
                    <span className="truncate">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trailing dock */}
          {slots.trailing.length > 0 && (
            <div className="flex shrink-0 flex-col items-end justify-start gap-1">
              {slots.trailing.map((cell) => (
                <div key={cell.id} className="text-right text-sm font-medium">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer slot: full width below main content */}
        {slots.footer.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-2 text-sm">
            {slots.footer.map((cell) => (
              <div key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ))}
          </div>
        )}

        {/* Expandable: optional-priority fields */}
        {slots.optional.length > 0 && (
          <div className="mt-2">
            {expanded && (
              <div className="mb-2 grid grid-cols-1 gap-x-4 gap-y-1 border-t pt-2 sm:grid-cols-2">
                {slots.optional.map((cell) => (
                  <div key={cell.id} className="flex items-baseline gap-1.5 text-sm">
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {getCellLabel(cell)}
                    </span>
                    <span className="truncate">
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
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {expanded ? "Show less" : `Show ${slots.optional.length} more fields`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
