import type { PluginContributionPredicate } from "@ghost/plugin-contracts";
import type { ContributionPredicateMatcher } from "@ghost/plugin-contracts";
import { createDefaultContributionPredicateMatcher } from "@ghost/plugin-contracts";
import type { ActionSurfaceContext, InvokableAction } from "../action-surface.js";
import type { NormalizedKeybindingChord } from "./keybinding-normalizer.js";

export type KeybindingLayer = "defaults" | "plugins" | "user-overrides";

export interface ResolvedKeybinding {
  action: InvokableAction;
  chord: NormalizedKeybindingChord;
  source: {
    layer: KeybindingLayer;
    pluginId: string;
  };
}

export interface RegisteredKeybindingRecord {
  action: InvokableAction;
  chord: NormalizedKeybindingChord;
  when?: PluginContributionPredicate | undefined;
  source: {
    layer: KeybindingLayer;
    pluginId: string;
  };
}

const defaultPredicateMatcher = createDefaultContributionPredicateMatcher();

export function resolveKeybindingMatch(
  records: readonly RegisteredKeybindingRecord[],
  chord: NormalizedKeybindingChord,
  context: ActionSurfaceContext,
  matcher: ContributionPredicateMatcher = defaultPredicateMatcher,
): ResolvedKeybinding | null {
  for (const record of records) {
    if (record.chord.value !== chord.value) {
      continue;
    }

    if (!evaluatePredicate(record.when, context, matcher)) {
      continue;
    }

    if (!evaluatePredicate(record.action.predicate, context, matcher)) {
      continue;
    }

    return {
      action: record.action,
      chord,
      source: record.source,
    };
  }

  return null;
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
