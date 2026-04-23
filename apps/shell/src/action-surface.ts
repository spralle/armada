import type {
  PluginActionContribution,
  PluginContract,
  PluginContributionPredicate,
  PluginKeybindingContribution,
  PluginMenuContribution,
} from "@ghost-shell/contracts";
import type {
  ContributionPredicateMatcher,
  PredicateFactBag,
} from "@ghost-shell/plugin-system";
import {
  createDefaultContributionPredicateMatcher,
} from "@ghost-shell/plugin-system";
import type { IntentResolutionDelegate, IntentRuntime, ShellIntent, IntentFactBag } from "./intent-runtime.js";

export interface ActionSurfaceContext {
  [key: string]: unknown;
}

export interface InvokableAction {
  id: string;
  title: string;
  intent: string;
  pluginId: string;
  when?: PluginContributionPredicate | undefined;
  hidden?: boolean | undefined;
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
  hidden?: boolean | undefined;
}

export interface ActionSurface {
  actions: InvokableAction[];
  menus: ActionMenuItem[];
  keybindings: ActionKeybinding[];
}

const defaultPredicateMatcher = createDefaultContributionPredicateMatcher();
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
  matcher: ContributionPredicateMatcher = defaultPredicateMatcher,
): InvokableAction[] {
  return surface.menus
    .filter((item) => item.menu === menuId)
    .filter((item) => evaluatePredicate(item.when, context, matcher))
    .sort(compareMenuItems)
    .map((item) => findAction(surface.actions, item.action))
    .filter((action): action is InvokableAction => action !== null)
    .filter((action) => evaluatePredicate(action.when, context, matcher));
}

/** Default delegate for action-by-ID dispatch: never shows chooser, assumes plugin already activated. */
const actionByIdDelegate: IntentResolutionDelegate = {
  async showChooser() { return null; },
  async activatePlugin() { return true; },
  announce() {},
};

export async function dispatchAction(
  surface: ActionSurface,
  runtime: IntentRuntime,
  actionId: string,
  context: ActionSurfaceContext,
  matcher: ContributionPredicateMatcher = defaultPredicateMatcher,
  delegate: IntentResolutionDelegate = actionByIdDelegate,
): Promise<boolean> {
  const action = findAction(surface.actions, actionId);
  if (!action) {
    return false;
  }

  if (!evaluatePredicate(action.when, context, matcher)) {
    return false;
  }

  const intent: ShellIntent = {
    type: action.intent,
    facts: normalizeContext(context) as IntentFactBag,
  };

  const outcome = await runtime.resolve(intent, delegate, { preferredActionId: actionId });
  return outcome.kind === "executed";
}

function mapAction(pluginId: string, contribution: PluginActionContribution): InvokableAction {
  return {
    id: contribution.id,
    title: contribution.title,
    intent: contribution.intent,
    when: contribution.when,
    pluginId,
    hidden: contribution.hidden,
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
    hidden: contribution.hidden,
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
  context: PredicateFactBag,
  matcher: ContributionPredicateMatcher,
): boolean {
  if (predicate === undefined) {
    return true;
  }

  return matcher.evaluate(predicate, context).matched;
}

function normalizeContext(context: ActionSurfaceContext): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(context)) {
    normalized[key] = typeof value === "string" ? value : String(value);
  }
  return normalized;
}
