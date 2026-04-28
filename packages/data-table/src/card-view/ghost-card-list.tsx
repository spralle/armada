import type { Table as TanStackTable } from "@tanstack/react-table";
import { Skeleton } from "@ghost-shell/ui";
import { GhostCardItem } from "./ghost-card-item.js";

export interface GhostCardListProps<TData> {
  table: TanStackTable<TData>;
  /** Message when no data */
  emptyMessage?: string;
  /** Loading state */
  loading?: boolean;
  loadingRows?: number;
}

function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}

export function GhostCardList<TData>({
  table,
  emptyMessage = "No results.",
  loading = false,
  loadingRows = 5,
}: GhostCardListProps<TData>) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: loadingRows }).map((_, i) => (
          <CardSkeleton key={`card-skeleton-${i}`} />
        ))}
      </div>
    );
  }

  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <GhostCardItem key={row.id} row={row} />
      ))}
    </div>
  );
}
