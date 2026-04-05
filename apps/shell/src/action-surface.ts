import type {
  PluginActionContribution,
  PluginContract,
  PluginContributionPredicate,
  PluginKeybindingContribution,
  PluginMenuContribution,
} from "@armada/plugin-contracts";

export interface ActionSurfaceContext {
  [key: string]: unknown;
}

export interface InvokableAction {
  id: string;
  title: string;
  intent: string;
  pluginId: string;
  predicate?: PluginContributionPredicate | undefined;
}

export interface ActionMenuItem {
  menu: string;
  action: string;
  group?: string | undefined;
  order?: number | undefined;
  when?: PluginContributionPredicate | undefined;
  pluginId: string;
}

export interface ActionKeybinding {
  action: string;
  keybinding: string;
  when?: PluginContributionPredicate | undefined;
  pluginId: string;
}

export interface ActionSurface {
  actions: InvokableAction[];
  menus: ActionMenuItem[];
  keybindings: ActionKeybinding[];
}

export interface IntentRuntime {
  dispatchIntent(intentId: string, payload: { actionId: string; pluginId: string }): Promise<void> | void;
}

export function buildActionSurface(contracts: readonly PluginContract[]): ActionSurface {
  const actions: InvokableAction[] = [];
  const knownActionIds = new Set<string>();

  for (const contract of contracts) {
    const pluginId = contract.manifest.id;
    for (const contribution of contract.contributes?.actions ?? []) {
      if (knownActionIds.has(contribution.id)) {
        continue;
      }

      knownActionIds.add(contribution.id);
      actions.push(mapAction(pluginId, contribution));
    }
  }

  const menus: ActionMenuItem[] = [];
  const keybindings: ActionKeybinding[] = [];
  const invokableActionIds = new Set(actions.map((action) => action.id));

  for (const contract of contracts) {
    const pluginId = contract.manifest.id;

    for (const contribution of contract.contributes?.menus ?? []) {
      if (!invokableActionIds.has(contribution.action)) {
        continue;
      }

      menus.push(mapMenu(pluginId, contribution));
    }

    for (const contribution of contract.contributes?.keybindings ?? []) {
      if (!invokableActionIds.has(contribution.action)) {
        continue;
      }

      keybindings.push(mapKeybinding(pluginId, contribution));
    }
  }

  return {
    actions,
    menus,
    keybindings,
  };
}

export function resolveMenuActions(
  surface: ActionSurface,
  menuId: string,
  context: ActionSurfaceContext,
): InvokableAction[] {
  return surface.menus
    .filter((item) => item.menu === menuId)
    .filter((item) => evaluatePredicate(item.when, context))
    .sort(compareMenuItems)
    .map((item) => findAction(surface.actions, item.action))
    .filter((action): action is InvokableAction => action !== null)
    .filter((action) => evaluatePredicate(action.predicate, context));
}

export function resolveKeybindingAction(
  surface: ActionSurface,
  normalizedKeybinding: string,
  context: ActionSurfaceContext,
): InvokableAction | null {
  const key = normalizeKeybinding(normalizedKeybinding);
  for (const contribution of surface.keybindings) {
    if (normalizeKeybinding(contribution.keybinding) !== key) {
      continue;
    }

    if (!evaluatePredicate(contribution.when, context)) {
      continue;
    }

    const action = findAction(surface.actions, contribution.action);
    if (!action) {
      continue;
    }

    if (!evaluatePredicate(action.predicate, context)) {
      continue;
    }

    return action;
  }

  return null;
}

export async function dispatchAction(
  surface: ActionSurface,
  runtime: IntentRuntime,
  actionId: string,
  context: ActionSurfaceContext,
): Promise<boolean> {
  const action = findAction(surface.actions, actionId);
  if (!action) {
    return false;
  }

  if (!evaluatePredicate(action.predicate, context)) {
    return false;
  }

  await runtime.dispatchIntent(action.intent, {
    actionId: action.id,
    pluginId: action.pluginId,
  });

  return true;
}

export function normalizeKeyboardEvent(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) {
    parts.push("ctrl");
  }
  if (event.shiftKey) {
    parts.push("shift");
  }
  if (event.altKey) {
    parts.push("alt");
  }
  if (event.metaKey) {
    parts.push("meta");
  }

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
  parts.push(key);
  return parts.join("+");
}

function mapAction(pluginId: string, contribution: PluginActionContribution): InvokableAction {
  return {
    id: contribution.id,
    title: contribution.title,
    intent: contribution.intent,
    predicate: contribution.predicate,
    pluginId,
  };
}

function mapMenu(pluginId: string, contribution: PluginMenuContribution): ActionMenuItem {
  return {
    menu: contribution.menu,
    action: contribution.action,
    group: contribution.group,
    order: contribution.order,
    when: contribution.when,
    pluginId,
  };
}

function mapKeybinding(pluginId: string, contribution: PluginKeybindingContribution): ActionKeybinding {
  return {
    action: contribution.action,
    keybinding: contribution.keybinding,
    when: contribution.when,
    pluginId,
  };
}

function findAction(actions: readonly InvokableAction[], actionId: string): InvokableAction | null {
  return actions.find((action) => action.id === actionId) ?? null;
}

function compareMenuItems(left: ActionMenuItem, right: ActionMenuItem): number {
  if ((left.group ?? "") < (right.group ?? "")) {
    return -1;
  }
  if ((left.group ?? "") > (right.group ?? "")) {
    return 1;
  }

  if ((left.order ?? 0) !== (right.order ?? 0)) {
    return (left.order ?? 0) - (right.order ?? 0);
  }

  return 0;
}

function evaluatePredicate(
  predicate: PluginContributionPredicate | undefined,
  context: ActionSurfaceContext,
): boolean {
  if (predicate === undefined) {
    return true;
  }

  if (typeof predicate === "string") {
    const expression = predicate.trim();
    if (!expression || expression === "true") {
      return true;
    }
    if (expression === "false") {
      return false;
    }

    const equalityMatch = expression.match(/^([a-zA-Z0-9_.-]+)\s*(?:==|=)\s*(.+)$/);
    if (equalityMatch) {
      const key = equalityMatch[1];
      const value = equalityMatch[2].trim();
      return String(context[key] ?? "") === trimQuotes(value);
    }

    return Boolean(context[expression]);
  }

  for (const [key, value] of Object.entries(predicate)) {
    if ((context[key] ?? null) !== value) {
      return false;
    }
  }

  return true;
}

function normalizeKeybinding(keybinding: string): string {
  return keybinding
    .toLowerCase()
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("+");
}

function trimQuotes(value: string): string {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}
