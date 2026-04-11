import { createDefaultContributionPredicateMatcher } from "@ghost/plugin-contracts";
import type { ActionSurface } from "../action-surface.js";
import type { SpecHarness } from "../context-state.spec-harness.js";
import { buildCommandPaletteCatalog } from "./command-palette-catalog.js";

function createEmptyActionSurface(): ActionSurface {
  return {
    actions: [],
    menus: [],
    keybindings: [],
  };
}

function createTestActionSurface(): ActionSurface {
  return {
    actions: [
      {
        id: "shell.action.open",
        title: "Open File",
        intent: "shell.intent.open",
        pluginId: "shell.core",
      },
      {
        id: "shell.action.save",
        title: "Save File",
        intent: "shell.intent.save",
        pluginId: "shell.core",
        predicate: {
          dirty: true,
        },
      },
      {
        id: "plugin.action.deploy",
        title: "Deploy",
        intent: "plugin.intent.deploy",
        pluginId: "plugin.deploy",
        predicate: {
          role: "admin",
        },
      },
    ],
    menus: [],
    keybindings: [
      {
        action: "shell.action.open",
        keybinding: "ctrl+o",
        pluginId: "shell.core",
      },
      {
        action: "plugin.action.deploy",
        keybinding: "ctrl+shift+d",
        pluginId: "plugin.deploy",
      },
    ],
  };
}

export function registerCommandPaletteCatalogSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;
  const matcher = createDefaultContributionPredicateMatcher();

  test("command-palette-catalog: empty action surface produces empty catalog", () => {
    const entries = buildCommandPaletteCatalog({
      actionSurface: createEmptyActionSurface(),
      context: {},
      matcher,
    });

    assertEqual(entries.length, 0, "empty surface should produce empty catalog");
  });

  test("command-palette-catalog: actions without predicates are always enabled", () => {
    const entries = buildCommandPaletteCatalog({
      actionSurface: createTestActionSurface(),
      context: {},
      matcher,
    });

    const openEntry = entries.find((e) => e.id === "shell.action.open");
    assertTruthy(openEntry, "open action should be present");
    assertEqual(openEntry?.enabled, true, "action without predicate should be enabled");
    assertEqual(openEntry?.disabledReason, null, "enabled action should have null disabled reason");
  });

  test("command-palette-catalog: actions with matching predicates are enabled", () => {
    const entries = buildCommandPaletteCatalog({
      actionSurface: createTestActionSurface(),
      context: { dirty: true },
      matcher,
    });

    const saveEntry = entries.find((e) => e.id === "shell.action.save");
    assertTruthy(saveEntry, "save action should be present");
    assertEqual(saveEntry?.enabled, true, "action with matching predicate should be enabled");
    assertEqual(saveEntry?.disabledReason, null, "enabled action should have null disabled reason");
  });

  test("command-palette-catalog: actions with non-matching predicates are disabled with reason", () => {
    const entries = buildCommandPaletteCatalog({
      actionSurface: createTestActionSurface(),
      context: { dirty: false },
      matcher,
    });

    const saveEntry = entries.find((e) => e.id === "shell.action.save");
    assertTruthy(saveEntry, "save action should be present");
    assertEqual(saveEntry?.enabled, false, "action with non-matching predicate should be disabled");
    assertEqual(
      saveEntry?.disabledReason,
      "Action 'Save File' is not available in current context",
      "disabled action should have reason text",
    );
  });

  test("command-palette-catalog: keybinding hints are mapped from action surface keybindings", () => {
    const entries = buildCommandPaletteCatalog({
      actionSurface: createTestActionSurface(),
      context: {},
      matcher,
    });

    const openEntry = entries.find((e) => e.id === "shell.action.open");
    assertTruthy(openEntry, "open action should be present");
    assertEqual(openEntry?.keybindingHint, "ctrl+o", "open action should have keybinding hint");

    const deployEntry = entries.find((e) => e.id === "plugin.action.deploy");
    assertTruthy(deployEntry, "deploy action should be present");
    assertEqual(deployEntry?.keybindingHint, "ctrl+shift+d", "deploy action should have keybinding hint");
  });

  test("command-palette-catalog: actions without keybindings have null hint", () => {
    const entries = buildCommandPaletteCatalog({
      actionSurface: createTestActionSurface(),
      context: {},
      matcher,
    });

    const saveEntry = entries.find((e) => e.id === "shell.action.save");
    assertTruthy(saveEntry, "save action should be present");
    assertEqual(saveEntry?.keybindingHint, null, "action without keybinding should have null hint");
  });

  test("command-palette-catalog: duplicate keybindings use first binding for action", () => {
    const surface: ActionSurface = {
      actions: [
        {
          id: "shell.action.test",
          title: "Test Action",
          intent: "shell.intent.test",
          pluginId: "shell.core",
        },
      ],
      menus: [],
      keybindings: [
        {
          action: "shell.action.test",
          keybinding: "ctrl+t",
          pluginId: "shell.core",
        },
        {
          action: "shell.action.test",
          keybinding: "ctrl+shift+t",
          pluginId: "shell.core",
        },
      ],
    };

    const entries = buildCommandPaletteCatalog({
      actionSurface: surface,
      context: {},
      matcher,
    });

    const testEntry = entries.find((e) => e.id === "shell.action.test");
    assertTruthy(testEntry, "test action should be present");
    assertEqual(testEntry?.keybindingHint, "ctrl+t", "should use first keybinding for action");
  });

  test("command-palette-catalog: category is always action for action-surface entries", () => {
    const entries = buildCommandPaletteCatalog({
      actionSurface: createTestActionSurface(),
      context: {},
      matcher,
    });

    for (const entry of entries) {
      assertEqual(entry.category, "action", `entry '${entry.id}' should have category 'action'`);
    }
  });

  test("command-palette-catalog: pluginId is correctly preserved", () => {
    const entries = buildCommandPaletteCatalog({
      actionSurface: createTestActionSurface(),
      context: {},
      matcher,
    });

    const openEntry = entries.find((e) => e.id === "shell.action.open");
    assertEqual(openEntry?.pluginId, "shell.core", "open action should preserve pluginId");

    const deployEntry = entries.find((e) => e.id === "plugin.action.deploy");
    assertEqual(deployEntry?.pluginId, "plugin.deploy", "deploy action should preserve pluginId");
  });
}
