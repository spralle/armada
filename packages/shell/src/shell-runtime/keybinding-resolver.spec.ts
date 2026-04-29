import type { NormalizedKeybindingChord, NormalizedKeybindingSequence } from "@ghost-shell/commands";
import {
  type KeybindingLayer,
  normalizeConfiguredChord,
  type RegisteredKeybindingRecord,
  resolveKeybindingMatch,
  resolveKeybindingSequence,
} from "@ghost-shell/commands";
import { createDefaultContributionPredicateMatcher } from "@ghost-shell/plugin-system";
import type { InvokableAction } from "../action-surface.js";
import type { SpecHarness } from "../context-state.spec-harness.js";

function chord(input: string): NormalizedKeybindingChord {
  const c = normalizeConfiguredChord(input);
  if (!c) throw new Error(`Invalid chord: ${input}`);
  return c;
}

function seq(...inputs: string[]): NormalizedKeybindingSequence {
  const chords = inputs.map(chord);
  return { chords, value: chords.map((c) => c.value).join(" ") };
}

function action(id: string): InvokableAction {
  return { id, title: id, intent: `intent.${id}`, pluginId: "test" };
}

function record(
  seqInputs: string[],
  layer: KeybindingLayer = "defaults",
  opts?: { when?: { role: string }; actionWhen?: { mode: string } },
): RegisteredKeybindingRecord {
  const act = action(seqInputs.join("-"));
  if (opts?.actionWhen) {
    (act as any).when = opts.actionWhen;
  }
  return {
    action: act,
    sequence: seq(...seqInputs),
    when: opts?.when,
    source: { layer, pluginId: "test" },
  };
}

export function registerKeybindingResolverSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("single-chord sequence exact match", () => {
    const records = [record(["ctrl+k"])];
    const result = resolveKeybindingSequence(records, [chord("ctrl+k")], {});
    assertEqual(result.kind, "exact", "should be exact match");
    assertEqual(result.match?.action.id, "ctrl+k", "should match the action");
  });

  test("two-chord sequence exact match", () => {
    const records = [record(["ctrl+k", "c"])];
    const result = resolveKeybindingSequence(records, [chord("ctrl+k"), chord("c")], {});
    assertEqual(result.kind, "exact", "should be exact match");
    assertEqual(result.match?.action.id, "ctrl+k-c", "should match the two-chord action");
  });

  test("prefix match returns prefix kind with count", () => {
    const records = [record(["ctrl+k", "c"])];
    const result = resolveKeybindingSequence(records, [chord("ctrl+k")], {});
    assertEqual(result.kind, "prefix", "should be prefix match");
    assertEqual(result.prefixCount, 1, "should have 1 prefix match");
  });

  test("no match returns none", () => {
    const records = [record(["ctrl+k", "c"])];
    const result = resolveKeybindingSequence(records, [chord("ctrl+z")], {});
    assertEqual(result.kind, "none", "should be no match");
  });

  test("layer precedence — higher-priority layer wins", () => {
    const records = [record(["ctrl+k"], "user-overrides"), record(["ctrl+k"], "defaults")];
    // Overwrite action id for distinction
    records[0]!.action = { ...records[0]?.action, id: "override" };
    records[1]!.action = { ...records[1]?.action, id: "default" };
    const result = resolveKeybindingSequence(records, [chord("ctrl+k")], {});
    assertEqual(result.kind, "exact", "should be exact");
    assertEqual(result.match?.action.id, "override", "user-override should win (first in pre-sorted list)");
  });

  test("predicate gating on exact match skips failing record", () => {
    const matcher = createDefaultContributionPredicateMatcher();
    const records = [record(["ctrl+h"], "defaults", { when: { role: "admin" } })];
    const noMatch = resolveKeybindingSequence(records, [chord("ctrl+h")], { role: "operator" }, matcher);
    assertEqual(noMatch.kind, "none", "should not match when predicate fails");

    const matched = resolveKeybindingSequence(records, [chord("ctrl+h")], { role: "admin" }, matcher);
    assertEqual(matched.kind, "exact", "should match when predicate passes");
  });

  test("empty pressedChords returns none", () => {
    const records = [record(["ctrl+k"])];
    const result = resolveKeybindingSequence(records, [], {});
    assertEqual(result.kind, "none", "empty input should return none");
  });

  test("multiple prefix matches counted correctly", () => {
    const records = [record(["ctrl+k", "c"]), record(["ctrl+k", "u"])];
    const result = resolveKeybindingSequence(records, [chord("ctrl+k")], {});
    assertEqual(result.kind, "prefix", "should be prefix");
    assertEqual(result.prefixCount, 2, "should count both prefix matches");
  });

  test("backward compat: resolveKeybindingMatch works for single-chord records", () => {
    const records = [record(["ctrl+s"])];
    const result = resolveKeybindingMatch(records, chord("ctrl+s"), {});
    assertEqual(result?.action.id, "ctrl+s", "resolveKeybindingMatch should still work");
    assertEqual(result?.sequence.value, "ctrl+s", "should have sequence field");
  });
}
