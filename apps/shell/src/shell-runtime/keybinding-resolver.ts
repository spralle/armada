import type { PluginContributionPredicate } from "@ghost/plugin-contracts";
import type { ContributionPredicateMatcher } from "@ghost/plugin-contracts";
import { createDefaultContributionPredicateMatcher } from "@ghost/plugin-contracts";
import type { ActionSurfaceContext, InvokableAction } from "../action-surface.js";
import type { NormalizedKeybindingChord, NormalizedKeybindingSequence } from "./keybinding-normalizer.js";

export type KeybindingLayer = "defaults" | "plugins" | "user-overrides";

export interface ResolvedKeybinding {
  action: InvokableAction;
  sequence: NormalizedKeybindingSequence;
  source: {
    layer: KeybindingLayer;
    pluginId: string;
  };
}

export interface RegisteredKeybindingRecord {
  action: InvokableAction;
  sequence: NormalizedKeybindingSequence;
  when?: PluginContributionPredicate | undefined;
  source: {
    layer: KeybindingLayer;
    pluginId: string;
  };
}

export interface SequenceResolutionResult {
  kind: "exact" | "prefix" | "none";
  /** Set only when kind === "exact" */
  match?: ResolvedKeybinding;
  /** Number of prefix-matching records (when kind === "prefix") */
  prefixCount?: number;
}

const defaultPredicateMatcher = createDefaultContributionPredicateMatcher();

export function resolveKeybindingSequence(
  records: readonly RegisteredKeybindingRecord[],
  pressedChords: readonly NormalizedKeybindingChord[],
  context: ActionSurfaceContext,
  matcher: ContributionPredicateMatcher = defaultPredicateMatcher,
): SequenceResolutionResult {
  if (pressedChords.length === 0) {
    return { kind: "none" };
  }

  let firstExact: ResolvedKeybinding | undefined;
  let prefixCount = 0;

  for (const record of records) {
    const seqChords = record.sequence.chords;

    if (seqChords.length < pressedChords.length) {
      continue;
    }

    let matches = true;
    for (let i = 0; i < pressedChords.length; i++) {
      if (seqChords[i]!.value !== pressedChords[i]!.value) {
        matches = false;
        break;
      }
    }

    if (!matches) {
      continue;
    }

    if (seqChords.length === pressedChords.length) {
      if (!firstExact) {
        if (
          evaluatePredicate(record.when, context, matcher) &&
          evaluatePredicate(record.action.predicate, context, matcher)
        ) {
          firstExact = {
            action: record.action,
            sequence: record.sequence,
            source: record.source,
          };
        }
      }
    } else {
      prefixCount++;
    }
  }

  if (firstExact) {
    return { kind: "exact", match: firstExact };
  }

  if (prefixCount > 0) {
    return { kind: "prefix", prefixCount };
  }

  return { kind: "none" };
}

export function resolveKeybindingMatch(
  records: readonly RegisteredKeybindingRecord[],
  chord: NormalizedKeybindingChord,
  context: ActionSurfaceContext,
  matcher: ContributionPredicateMatcher = defaultPredicateMatcher,
): ResolvedKeybinding | null {
  const result = resolveKeybindingSequence(records, [chord], context, matcher);
  return result.kind === "exact" ? result.match! : null;
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
