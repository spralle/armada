import type { MenuService, ResolvedMenuAction } from "@ghost-shell/contracts";
import type { ActionSurface } from "../action-surface.js";
import { resolveMenuActions, dispatchAction } from "../action-surface.js";
import type { IntentRuntime } from "@ghost-shell/intents";

/**
 * Dependencies required by MenuService to bridge shell internals.
 */
export interface MenuServiceDependencies {
  /** Returns the current aggregated action surface. */
  getActionSurface(): ActionSurface;
  /** Returns the intent runtime for action dispatch. */
  getIntentRuntime(): IntentRuntime;
}

/**
 * Create a MenuService that resolves menu contributions and dispatches actions
 * via the shell's action surface and intent runtime.
 */
export function createMenuService(deps: MenuServiceDependencies): MenuService {
  return {
    resolve(menuId: string, context: Record<string, unknown>): ResolvedMenuAction[] {
      const surface = deps.getActionSurface();
      const actions = resolveMenuActions(surface, menuId, context);

      // Build a lookup for group/order from menu items
      const menuItems = surface.menus.filter(m => m.menu === menuId);
      const menuItemByAction = new Map(menuItems.map(m => [m.action, m]));

      return actions.map(action => {
        const menuItem = menuItemByAction.get(action.id);
        return {
          id: action.id,
          title: action.title,
          group: menuItem?.group,
          order: menuItem?.order,
        };
      });
    },

    async dispatch(actionId: string, context: Record<string, unknown>): Promise<boolean> {
      const surface = deps.getActionSurface();
      const runtime = deps.getIntentRuntime();
      return dispatchAction(surface, runtime, actionId, context);
    },
  };
}
