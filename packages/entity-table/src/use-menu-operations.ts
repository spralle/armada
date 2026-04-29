import type { MenuService } from "@ghost-shell/contracts";
import { useMemo } from "react";

export interface MenuOperationItem {
  id: string;
  label: string;
  group?: string;
  order?: number;
  onAction: () => Promise<boolean>;
}

/**
 * Resolves Ghost menu contributions for a given menu point.
 * Returns items ready to render, with dispatch wired in.
 */
export function useMenuOperations(
  menuService: MenuService | undefined,
  menuId: string,
  context: Record<string, unknown>,
): MenuOperationItem[] {
  return useMemo(() => {
    if (!menuService) return [];
    const resolved = menuService.resolve(menuId, context);
    return resolved.map((action) => ({
      id: action.id,
      label: action.title,
      group: action.group,
      order: action.order,
      onAction: () => menuService.dispatch(action.id, context),
    }));
  }, [menuService, menuId, context]);
}
