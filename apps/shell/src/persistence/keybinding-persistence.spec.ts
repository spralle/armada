import type { SpecHarness } from "../context-state.spec-harness.js";
import { MemoryStorage } from "../context-state.spec-harness.js";
import { createLocalStorageKeybindingPersistence } from "./keybinding-persistence.js";
import {
  KEYBINDING_OVERRIDES_SCHEMA_VERSION,
  SHELL_PERSISTENCE_SCHEMA_VERSION,
  getUnifiedStorageKey,
} from "./envelope.js";

function makeEnvelope(sections: Record<string, unknown>): string {
  return JSON.stringify({
    version: SHELL_PERSISTENCE_SCHEMA_VERSION,
    ...sections,
  });
}

function makeKeybindingsSection(overrides: unknown[]): unknown {
  return {
    version: KEYBINDING_OVERRIDES_SCHEMA_VERSION,
    overrides,
  };
}

export function registerKeybindingPersistenceSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;
  const userId = "test-user";
  const storageKey = getUnifiedStorageKey(userId);

  test("load returns empty array when storage is undefined", () => {
    const persistence = createLocalStorageKeybindingPersistence(undefined, { userId });
    const result = persistence.load();
    assertEqual(result.length, 0, "should return empty array");
  });

  test("load returns empty array when no keybindings section exists", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKey, makeEnvelope({ layout: { version: 1, state: {} } }));
    const persistence = createLocalStorageKeybindingPersistence(storage, { userId });
    const result = persistence.load();
    assertEqual(result.length, 0, "should return empty array when keybindings section is missing");
  });

  test("load returns entries when valid envelope with keybindings exists", () => {
    const storage = new MemoryStorage();
    const overrides = [
      { action: "shell.focus.left", keybinding: "ctrl+h" },
      { action: "shell.focus.right", keybinding: "ctrl+l", removed: true },
    ];
    storage.setItem(storageKey, makeEnvelope({ keybindings: makeKeybindingsSection(overrides) }));
    const persistence = createLocalStorageKeybindingPersistence(storage, { userId });
    const result = persistence.load();
    assertEqual(result.length, 2, "should return two entries");
    assertEqual(result[0].action, "shell.focus.left", "first entry action");
    assertEqual(result[0].keybinding, "ctrl+h", "first entry keybinding");
    assertEqual(result[1].removed, true, "second entry removed flag");
  });

  test("load prunes entries with empty action", () => {
    const storage = new MemoryStorage();
    const overrides = [
      { action: "", keybinding: "ctrl+h" },
      { action: "shell.focus.left", keybinding: "ctrl+h" },
    ];
    storage.setItem(storageKey, makeEnvelope({ keybindings: makeKeybindingsSection(overrides) }));
    const persistence = createLocalStorageKeybindingPersistence(storage, { userId });
    const result = persistence.load();
    assertEqual(result.length, 1, "should prune entry with empty action");
    assertEqual(result[0].action, "shell.focus.left", "remaining entry action");
  });

  test("load prunes entries with empty keybinding", () => {
    const storage = new MemoryStorage();
    const overrides = [
      { action: "shell.focus.left", keybinding: "" },
      { action: "shell.focus.right", keybinding: "ctrl+l" },
    ];
    storage.setItem(storageKey, makeEnvelope({ keybindings: makeKeybindingsSection(overrides) }));
    const persistence = createLocalStorageKeybindingPersistence(storage, { userId });
    const result = persistence.load();
    assertEqual(result.length, 1, "should prune entry with empty keybinding");
    assertEqual(result[0].action, "shell.focus.right", "remaining entry action");
  });

  test("save merges keybindings into existing envelope preserving layout and context", () => {
    const storage = new MemoryStorage();
    const existingLayout = { version: 1, state: { columns: 2 } };
    const existingContext = { version: 2, contextState: { tabs: [] } };
    storage.setItem(storageKey, makeEnvelope({ layout: existingLayout, context: existingContext }));

    const persistence = createLocalStorageKeybindingPersistence(storage, { userId });
    const result = persistence.save([{ action: "shell.focus.left", keybinding: "ctrl+h" }]);
    assertEqual(result.warning, null, "save should succeed without warning");

    const stored = JSON.parse(storage.getItem(storageKey)!);
    assertTruthy(stored.layout, "layout should be preserved");
    assertTruthy(stored.context, "context should be preserved");
    assertTruthy(stored.keybindings, "keybindings should be set");
    assertEqual(stored.keybindings.version, 1, "keybindings version");
    assertEqual(stored.keybindings.overrides.length, 1, "one override stored");
    assertEqual(stored.keybindings.overrides[0].action, "shell.focus.left", "stored action");
  });

  test("save works with empty storage", () => {
    const storage = new MemoryStorage();
    const persistence = createLocalStorageKeybindingPersistence(storage, { userId });
    const result = persistence.save([{ action: "shell.focus.up", keybinding: "ctrl+k" }]);
    assertEqual(result.warning, null, "save should succeed");

    const stored = JSON.parse(storage.getItem(storageKey)!);
    assertEqual(stored.version, 1, "envelope version");
    assertEqual(stored.keybindings.overrides.length, 1, "one override stored");
  });

  test("save returns null warning when storage is undefined", () => {
    const persistence = createLocalStorageKeybindingPersistence(undefined, { userId });
    const result = persistence.save([{ action: "shell.focus.up", keybinding: "ctrl+k" }]);
    assertEqual(result.warning, null, "should return null warning");
  });

  test("load returns empty array when envelope is corrupted", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKey, "not-json");
    const persistence = createLocalStorageKeybindingPersistence(storage, { userId });
    const result = persistence.load();
    assertEqual(result.length, 0, "should return empty array for corrupted envelope");
  });
}
