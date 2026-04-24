import type { SpecHarness } from "../context-state.spec-harness.js";
import { normalizeConfiguredChord, normalizeConfiguredSequence } from "./keybinding-normalizer.js";

export function registerKeybindingNormalizerSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("normalizeConfiguredSequence parses two-chord sequence", () => {
    const result = normalizeConfiguredSequence("ctrl+k c");
    assertTruthy(result, "should return a sequence");
    assertEqual(result!.chords.length, 2, "should have 2 chords");
    assertEqual(result!.chords[0]!.value, "ctrl+k", "first chord should be ctrl+k");
    assertEqual(result!.chords[1]!.value, "c", "second chord should be c");
    assertEqual(result!.value, "ctrl+k c", "sequence value should join chords with space");
  });

  test("normalizeConfiguredSequence parses three-chord sequence", () => {
    const result = normalizeConfiguredSequence("ctrl+shift+alt+g o d");
    assertTruthy(result, "should return a sequence");
    assertEqual(result!.chords.length, 3, "should have 3 chords");
    assertEqual(result!.value, "ctrl+shift+alt+g o d", "sequence value should be canonical");
  });

  test("normalizeConfiguredSequence parses single-chord sequence", () => {
    const result = normalizeConfiguredSequence("ctrl+shift+p");
    assertTruthy(result, "should return a sequence");
    assertEqual(result!.chords.length, 1, "should have 1 chord");
    assertEqual(result!.value, "ctrl+shift+p", "sequence value should match chord value");
  });

  test("normalizeConfiguredSequence returns null for empty string", () => {
    assertEqual(normalizeConfiguredSequence(""), null, "empty string should return null");
  });

  test("normalizeConfiguredSequence returns null for whitespace-only string", () => {
    assertEqual(normalizeConfiguredSequence("   "), null, "whitespace-only should return null");
  });

  test("normalizeConfiguredSequence returns null when any token is invalid", () => {
    assertEqual(normalizeConfiguredSequence("ctrl+k +++"), null, "invalid token should make entire sequence null");
  });

  test("normalizeConfiguredSequence normalizes each token independently", () => {
    const result = normalizeConfiguredSequence("Shift + Ctrl + P");
    assertTruthy(result, "should return a sequence");
    assertEqual(result!.chords.length, 1, "should have 1 chord after normalization");
    assertEqual(result!.value, "ctrl+shift+p", "should apply canonical ordering per token");
  });

  test("normalizeConfiguredSequence handles multiple spaces between tokens", () => {
    const result = normalizeConfiguredSequence("ctrl+k  c");
    assertTruthy(result, "should return a sequence");
    assertEqual(result!.chords.length, 2, "should have 2 chords");
    assertEqual(result!.value, "ctrl+k c", "should normalize spacing in value");
  });

  test("normalizeConfiguredChord regression: canonical ordering", () => {
    const result = normalizeConfiguredChord("ctrl+shift+p");
    assertTruthy(result, "should return a chord");
    assertEqual(result!.value, "ctrl+shift+p", "should match expected value");
  });

  test("normalizeConfiguredChord regression: reorders modifiers canonically", () => {
    const result = normalizeConfiguredChord("Shift+Ctrl+P");
    assertTruthy(result, "should return a chord");
    assertEqual(result!.value, "ctrl+shift+p", "should enforce canonical modifier order");
  });
}
