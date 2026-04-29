import type { MenuService } from "@ghost-shell/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ghost-shell/ui";
import type { Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { useMemo } from "react";
import type { EntityOperation } from "./entity-list-types.js";

interface RowActionsCellProps<TData> {
  row: Row<TData>;
  data: TData[];
  entityType: string;
  operations: EntityOperation<TData>[];
  menuService?: MenuService;
}

/**
 * Row actions cell — merges prop-based operations with
 * Ghost menu contributions for the 'entityTable/row' menu point.
 */
export function RowActionsCell<TData>({ row, data, entityType, operations, menuService }: RowActionsCellProps<TData>) {
  const entity = row.original;
  const ctx = { entity, data };

  // biome-ignore lint/correctness/useExhaustiveDependencies: ctx is derived from entity+data already in deps
  const propItems = useMemo(() => {
    const sorted = [...operations].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return sorted.filter((op) => !op.when || op.when(ctx));
  }, [operations, entity, data]);

  const menuContext = useMemo(() => ({ entityType, entity: entity as Record<string, unknown> }), [entityType, entity]);

  const menuItems = useMemo(() => {
    if (!menuService) return [];
    return menuService.resolve("entityTable/row", menuContext);
  }, [menuService, menuContext]);

  // Props win on ID collision
  const propIds = new Set(propItems.map((op) => op.id));
  const dedupedMenuItems = menuItems.filter((m) => !propIds.has(m.id));

  if (propItems.length === 0 && dedupedMenuItems.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {propItems.map((op) => (
          <DropdownMenuItem key={op.id} onClick={() => op.handler(ctx)}>
            {op.icon}
            {op.label}
          </DropdownMenuItem>
        ))}
        {propItems.length > 0 && dedupedMenuItems.length > 0 && <DropdownMenuSeparator />}
        {dedupedMenuItems.map((item) => (
          <DropdownMenuItem key={item.id} onClick={() => menuService!.dispatch(item.id, menuContext)}>
            {item.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
