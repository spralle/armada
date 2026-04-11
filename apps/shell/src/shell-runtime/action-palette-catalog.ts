import type {
  ContributionPredicateMatcher,
  PluginContributionPredicate,
} from "@ghost/plugin-contracts";
import { createDefaultContributionPredicateMatcher } from "@ghost/plugin-contracts";
import type {
  ActionKeybinding,
  ActionSurface,
  ActionSurfaceContext,
} from "../action-surface.js";

export interface ActionPaletteCatalogEntry {
  id: string;
  title: string;
  category: "action";
  keybindingHint: string | null;
  enabled: boolean;
  disabledReason: string | null;
  pluginId: string;
}

export interface ActionPaletteCatalogOptions {
  actionSurface: ActionSurface;
  context: ActionSurfaceContext;
  matcher?: ContributionPredicateMatcher;
}

const defaultPredicateMatcher = createDefaultContributionPredicateMatcher();

export function buildActionPaletteCatalog(
  options: ActionPaletteCatalogOptions,
): ActionPaletteCatalogEntry[] {
  const { actionSurface, context } = options;
  const matcher = options.matcher ?? defaultPredicateMatcher;
  const keybindingsByAction = indexKeybindingsByAction(actionSurface.keybindings);

  const entries: ActionPaletteCatalogEntry[] = [];

  for (const action of actionSurface.actions) {
    const enabled = evaluatePredicate(action.predicate, context, matcher);
    const keybinding = keybindingsByAction.get(action.id) ?? null;

    entries.push({
      id: action.id,
      title: action.title,
      category: "action",
      keybindingHint: keybinding,
      enabled,
      disabledReason: enabled ? null : `Action '${action.title}' is not available in current context`,
      pluginId: action.pluginId,
    });
  }

  return entries;
}

function indexKeybindingsByAction(
  keybindings: readonly ActionKeybinding[],
): Map<string, string> {
  const map = new Map<string, string>();

  for (const binding of keybindings) {
    if (!map.has(binding.action)) {
      map.set(binding.action, binding.keybinding);
    }
  }

  return map;
}

function evaluatePredicate(
  predicate: PluginContributionPredicate | undefined,
  context: ActionSurfaceContext,
  matcher: ContributionPredicateMatcher,
): boolean {
  if (predicate === undefined) {
    return true;
  }

  return matcher.evaluate(predicate, context).matched;
}
