import type { SpecHarness } from "../context-state.spec-harness.js";
import type { KeybindingOverrideEntryV1 } from "../persistence/contracts.js";
import {
  exportKeybindingOverrides,
  validateKeybindingImport,
} from "./keybinding-import-export.js";

export function registerKeybindingImportExportSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  // -------------------------------------------------------------------------
  // exportKeybindingOverrides
  // -------------------------------------------------------------------------

  test("exportKeybindingOverrides returns envelope with version 1", () => {
    const overrides: KeybindingOverrideEntryV1[] = [
      { action: "shell.focus.left", keybinding: "ctrl+h" },
    ];
    const envelope = exportKeybindingOverrides(overrides);
    assertEqual(envelope.version, 1, "version should be 1");
    assertTruthy(envelope.exportedAt.length > 0, "exportedAt should be non-empty ISO string");
    assertEqual(envelope.overrides.length, 1, "should have one override");
    assertEqual(envelope.overrides[0].action, "shell.focus.left", "action preserved");
    assertEqual(envelope.overrides[0].keybinding, "ctrl+h", "keybinding preserved");
  });

  test("exportKeybindingOverrides strips extra properties from entries", () => {
    const overrides: KeybindingOverrideEntryV1[] = [
      { action: "a", keybinding: "ctrl+a", removed: true },
    ];
    const envelope = exportKeybindingOverrides(overrides);
    assertEqual(envelope.overrides[0].action, "a", "action kept");
    assertEqual(envelope.overrides[0].keybinding, "ctrl+a", "keybinding kept");
    assertEqual((envelope.overrides[0] as unknown as Record<string, unknown>).removed, undefined, "removed should be stripped");
  });

  test("exportKeybindingOverrides with empty overrides returns empty array", () => {
    const envelope = exportKeybindingOverrides([]);
    assertEqual(envelope.version, 1, "version should be 1");
    assertEqual(envelope.overrides.length, 0, "should have no overrides");
  });

  // -------------------------------------------------------------------------
  // validateKeybindingImport — valid cases
  // -------------------------------------------------------------------------

  test("validateKeybindingImport accepts valid import with known actions", () => {
    const known = new Set(["shell.focus.left", "shell.focus.right"]);
    const input = {
      version: 1,
      overrides: [
        { action: "shell.focus.left", keybinding: "ctrl+j" },
        { action: "shell.focus.right", keybinding: "ctrl+k" },
      ],
    };
    const result = validateKeybindingImport(input, known);
    assertEqual(result.success, true, "should succeed");
    assertEqual(result.entries.length, 2, "should have two entries");
    assertEqual(result.warnings.length, 0, "should have no warnings");
    assertEqual(result.errors.length, 0, "should have no errors");
  });

  test("validateKeybindingImport normalizes keybinding chords", () => {
    const known = new Set(["a"]);
    const input = { version: 1, overrides: [{ action: "a", keybinding: "Shift + Ctrl + P" }] };
    const result = validateKeybindingImport(input, known);
    assertEqual(result.success, true, "should succeed");
    assertEqual(result.entries[0].keybinding, "ctrl+shift+p", "chord should be normalized");
  });

  test("validateKeybindingImport warns for unknown actions but includes them", () => {
    const known = new Set(["shell.focus.left"]);
    const input = {
      version: 1,
      overrides: [{ action: "unknown.action", keybinding: "ctrl+u" }],
    };
    const result = validateKeybindingImport(input, known);
    assertEqual(result.success, true, "should succeed");
    assertEqual(result.entries.length, 1, "unknown action should still be included");
    assertEqual(result.warnings.length, 1, "should have one warning for unknown action");
  });

  // -------------------------------------------------------------------------
  // validateKeybindingImport — rejection cases
  // -------------------------------------------------------------------------

  test("validateKeybindingImport rejects non-object input", () => {
    const known = new Set<string>();
    const result = validateKeybindingImport("not an object", known);
    assertEqual(result.success, false, "should fail");
    assertTruthy(result.errors.length > 0, "should have errors");
  });

  test("validateKeybindingImport rejects null input", () => {
    const known = new Set<string>();
    const result = validateKeybindingImport(null, known);
    assertEqual(result.success, false, "should fail for null");
  });

  test("validateKeybindingImport rejects array input", () => {
    const known = new Set<string>();
    const result = validateKeybindingImport([1, 2, 3], known);
    assertEqual(result.success, false, "should fail for array");
  });

  test("validateKeybindingImport rejects unsupported version", () => {
    const known = new Set<string>();
    const input = { version: 99, overrides: [] };
    const result = validateKeybindingImport(input, known);
    assertEqual(result.success, false, "should fail for unsupported version");
    assertTruthy(result.errors[0].includes("version"), "error should mention version");
  });

  test("validateKeybindingImport rejects missing overrides array", () => {
    const known = new Set<string>();
    const input = { version: 1 };
    const result = validateKeybindingImport(input, known);
    assertEqual(result.success, false, "should fail for missing overrides");
    assertTruthy(result.errors[0].includes("overrides"), "error should mention overrides");
  });

  // -------------------------------------------------------------------------
  // validateKeybindingImport — invalid entries
  // -------------------------------------------------------------------------

  test("validateKeybindingImport skips entry that is not an object", () => {
    const known = new Set(["a"]);
    const input = { version: 1, overrides: ["not-an-object", { action: "a", keybinding: "ctrl+a" }] };
    const result = validateKeybindingImport(input, known);
    assertEqual(result.success, true, "should succeed with valid entries");
    assertEqual(result.entries.length, 1, "should have one valid entry");
    assertEqual(result.warnings.length, 1, "should have one warning for skipped entry");
  });

  test("validateKeybindingImport skips entry with empty action", () => {
    const known = new Set<string>();
    const input = { version: 1, overrides: [{ action: "", keybinding: "ctrl+a" }] };
    const result = validateKeybindingImport(input, known);
    assertEqual(result.success, false, "should fail when no valid entries remain");
    assertTruthy(result.warnings.length > 0, "should warn about empty action");
  });

  test("validateKeybindingImport skips entry with empty keybinding", () => {
    const known = new Set<string>();
    const input = { version: 1, overrides: [{ action: "a", keybinding: "" }] };
    const result = validateKeybindingImport(input, known);
    assertEqual(result.success, false, "should fail when no valid entries remain");
    assertTruthy(result.warnings.length > 0, "should warn about empty keybinding");
  });

  test("validateKeybindingImport skips entry with invalid chord", () => {
    const known = new Set(["a"]);
    const input = { version: 1, overrides: [{ action: "a", keybinding: "+++" }] };
    const result = validateKeybindingImport(input, known);
    assertEqual(result.success, false, "should fail when no valid entries remain");
    assertTruthy(result.warnings.length > 0, "should warn about invalid chord");
  });

  test("validateKeybindingImport keeps valid entries alongside invalid ones", () => {
    const known = new Set(["good.action"]);
    const input = {
      version: 1,
      overrides: [
        { action: "good.action", keybinding: "ctrl+g" },
        { action: "", keybinding: "ctrl+x" },
        { action: "good.action", keybinding: "+++" },
        42,
      ],
    };
    const result = validateKeybindingImport(input, known);
    assertEqual(result.success, true, "should succeed with at least one valid entry");
    assertEqual(result.entries.length, 1, "should keep one valid entry");
    assertEqual(result.warnings.length, 3, "should have three warnings for invalid entries");
  });

  test("validateKeybindingImport fails when all entries are invalid", () => {
    const known = new Set<string>();
    const input = {
      version: 1,
      overrides: [
        { action: "", keybinding: "ctrl+a" },
        { action: "b", keybinding: "+++" },
      ],
    };
    const result = validateKeybindingImport(input, known);
    assertEqual(result.success, false, "should fail when no valid entries");
    assertTruthy(result.errors.length > 0, "should have errors");
    assertEqual(result.entries.length, 0, "should have no entries");
  });

  test("validateKeybindingImport succeeds for empty overrides array", () => {
    const known = new Set<string>();
    const input = { version: 1, overrides: [] };
    const result = validateKeybindingImport(input, known);
    assertEqual(result.success, true, "empty overrides is valid");
    assertEqual(result.entries.length, 0, "no entries");
    assertEqual(result.errors.length, 0, "no errors");
  });
}
