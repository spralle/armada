import type { SpecHarness } from "../context-state.spec-harness.js";
import type { ActionKeybinding } from "../action-surface.js";
import type {
  KeybindingOverrideEntryV1,
  ShellKeybindingPersistence,
} from "../persistence/contracts.js";
import { createKeybindingOverrideManager } from "./keybinding-override-manager.js";

function createMockPersistence(): ShellKeybindingPersistence & { saved: KeybindingOverrideEntryV1[][] } {
  const saved: KeybindingOverrideEntryV1[][] = [];
  let current: KeybindingOverrideEntryV1[] = [];
  return {
    saved,
    load: () => [...current],
    save: (overrides) => {
      current = [...overrides];
      saved.push([...overrides]);
      return { warning: null };
    },
  };
}

const DEFAULT_BINDINGS: ActionKeybinding[] = [
  { action: "shell.focus.left", keybinding: "ctrl+h", pluginId: "com.ghost.shell.defaults" },
  { action: "shell.focus.right", keybinding: "ctrl+l", pluginId: "com.ghost.shell.defaults" },
];

const PLUGIN_BINDINGS: ActionKeybinding[] = [
  { action: "plugin.action.search", keybinding: "ctrl+shift+f", pluginId: "com.ghost.plugin.search" },
  { action: "plugin.action.terminal", keybinding: "ctrl+`", pluginId: "com.ghost.plugin.terminal" },
];

export function registerKeybindingOverrideManagerSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("addOverride with no conflicts succeeds", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const result = manager.addOverride("shell.focus.left", "ctrl+j");
    assertEqual(result.success, true, "should succeed");
    assertEqual(result.conflicts.length, 0, "should have no conflicts");
    assertEqual(result.warning, null, "should have no warning");
    assertEqual(persistence.saved.length, 1, "should have persisted once");
  });

  test("addOverride that conflicts with a default binding returns conflict info", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const result = manager.addOverride("custom.action", "ctrl+h");
    assertEqual(result.success, true, "should still succeed");
    assertEqual(result.conflicts.length, 1, "should detect one conflict");
    assertEqual(result.conflicts[0].action, "shell.focus.left", "conflict action");
    assertEqual(result.conflicts[0].layer, "defaults", "conflict layer");
    assertEqual(result.conflicts[0].pluginId, "com.ghost.shell.defaults", "conflict pluginId");
  });

  test("addOverride that conflicts with a plugin binding returns conflict info", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const result = manager.addOverride("custom.action", "ctrl+shift+f");
    assertEqual(result.success, true, "should still succeed");
    assertEqual(result.conflicts.length, 1, "should detect one conflict");
    assertEqual(result.conflicts[0].action, "plugin.action.search", "conflict action");
    assertEqual(result.conflicts[0].layer, "plugins", "conflict layer");
    assertEqual(result.conflicts[0].pluginId, "com.ghost.plugin.search", "conflict pluginId");
  });

  test("addOverride that conflicts with an existing user override returns conflict info", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("first.action", "ctrl+k");
    const result = manager.addOverride("second.action", "ctrl+k");
    assertEqual(result.success, true, "should still succeed");
    assertEqual(result.conflicts.length, 1, "should detect one user-override conflict");
    assertEqual(result.conflicts[0].action, "first.action", "conflict action");
    assertEqual(result.conflicts[0].layer, "user-overrides", "conflict layer");
  });

  test("removeOverride for existing override succeeds", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("shell.focus.left", "ctrl+j");
    assertEqual(manager.getOverrides().length, 1, "should have one override before removal");

    const result = manager.removeOverride("shell.focus.left");
    assertEqual(result.success, true, "removal should succeed");
    assertEqual(manager.getOverrides().length, 0, "should have no overrides after removal");
    assertEqual(persistence.saved.length, 2, "should have persisted twice (add + remove)");
  });

  test("removeOverride for non-existent override is a no-op success", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const result = manager.removeOverride("nonexistent.action");
    assertEqual(result.success, true, "removal of non-existent should succeed");
    assertEqual(result.conflicts.length, 0, "should have no conflicts");
    assertEqual(persistence.saved.length, 0, "should not persist on no-op");
  });

  test("resetToDefaults clears all overrides", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("action.a", "ctrl+1");
    manager.addOverride("action.b", "ctrl+2");
    assertEqual(manager.getOverrides().length, 2, "should have two overrides before reset");

    manager.resetToDefaults();
    assertEqual(manager.getOverrides().length, 0, "should have no overrides after reset");
    const lastSaved = persistence.saved[persistence.saved.length - 1];
    assertTruthy(lastSaved, "should have persisted after reset");
    assertEqual(lastSaved.length, 0, "persisted array should be empty after reset");
  });

  test("listConflicts returns structured conflict info across all layers", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("user.action", "ctrl+h");

    const conflicts = manager.listConflicts("ctrl+h");
    assertEqual(conflicts.length, 2, "should detect default and user-override conflicts");

    const defaultConflict = conflicts.find((c) => c.layer === "defaults");
    assertTruthy(defaultConflict, "should find default layer conflict");
    assertEqual(defaultConflict!.action, "shell.focus.left", "default conflict action");

    const userConflict = conflicts.find((c) => c.layer === "user-overrides");
    assertTruthy(userConflict, "should find user-override layer conflict");
    assertEqual(userConflict!.action, "user.action", "user override conflict action");
  });

  test("listConflicts returns empty array for unused chord", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const conflicts = manager.listConflicts("ctrl+shift+alt+z");
    assertEqual(conflicts.length, 0, "should return empty array for unused chord");
  });

  test("getOverrides returns current state as defensive copy", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("action.x", "ctrl+x");
    const overrides = manager.getOverrides();
    assertEqual(overrides.length, 1, "should have one override");
    assertEqual(overrides[0].action, "action.x", "override action");
    assertEqual(overrides[0].keybinding, "ctrl+x", "override keybinding is normalized");

    // Mutating the returned array should not affect the manager
    overrides.push({ action: "action.y", keybinding: "ctrl+y" });
    assertEqual(manager.getOverrides().length, 1, "mutation should not affect internal state");
  });

  test("overrides persist via persistence layer", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("action.a", "ctrl+1");
    manager.addOverride("action.b", "ctrl+2");
    manager.removeOverride("action.a");

    assertEqual(persistence.saved.length, 3, "should have three save calls (2 adds + 1 remove)");
    const lastSaved = persistence.saved[2];
    assertEqual(lastSaved.length, 1, "last persisted state should have one entry");
    assertEqual(lastSaved[0].action, "action.b", "remaining override action");
    assertEqual(lastSaved[0].keybinding, "ctrl+2", "remaining override keybinding");
  });

  test("addOverride with invalid keybinding fails gracefully", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const result = manager.addOverride("action.a", "+++");
    assertEqual(result.success, false, "should fail for invalid chord");
    assertEqual(result.warning, "Invalid keybinding chord", "should report warning");
    assertEqual(persistence.saved.length, 0, "should not persist invalid override");
  });

  test("addOverride normalizes chord before storing", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("action.a", "Shift + Ctrl + P");
    const overrides = manager.getOverrides();
    assertEqual(overrides.length, 1, "should have one override");
    assertEqual(overrides[0].keybinding, "ctrl+shift+p", "chord should be normalized");
  });

  test("addOverride updates existing override for same action", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("action.a", "ctrl+1");
    manager.addOverride("action.a", "ctrl+2");
    const overrides = manager.getOverrides();
    assertEqual(overrides.length, 1, "should have one override (updated, not duplicated)");
    assertEqual(overrides[0].keybinding, "ctrl+2", "keybinding should be updated");
  });

  test("listConflicts with invalid chord returns empty array", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const conflicts = manager.listConflicts("+++");
    assertEqual(conflicts.length, 0, "invalid chord should return empty conflicts");
  });

  test("manager initializes overrides from persistence.load()", () => {
    const persistence = createMockPersistence();
    // Pre-populate persistence with saved data via save
    persistence.save([
      { action: "preloaded.action", keybinding: "ctrl+p" },
    ]);

    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const overrides = manager.getOverrides();
    assertEqual(overrides.length, 1, "should initialize from persistence");
    assertEqual(overrides[0].action, "preloaded.action", "should have preloaded action");
    assertEqual(overrides[0].keybinding, "ctrl+p", "should have preloaded keybinding");
  });
}
