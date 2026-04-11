import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePluginContract,
  deriveFullPalette,
} from "../../../packages/plugin-contracts/dist/index.js";
import { pluginContract } from "../../theme-default-plugin/src/plugin-contract.ts";

// ---------------------------------------------------------------------------
// Contract validation
// ---------------------------------------------------------------------------

test("default theme plugin contract validates against parsePluginContract", () => {
  const result = parsePluginContract(pluginContract);

  assert.equal(result.success, true, "Plugin contract must be valid");
  if (result.success) {
    assert.equal(result.data.manifest.id, "ghost.theme.default");
    assert.equal(result.data.manifest.name, "Ghost Default Themes");
    assert.deepEqual(result.data.activationEvents, ["onStartup"]);
  }
});

// ---------------------------------------------------------------------------
// Both themes are present
// ---------------------------------------------------------------------------

test("plugin contract contains both Default Dark and Tokyo Night themes", () => {
  const themes = pluginContract.contributes?.themes;

  assert.ok(themes, "contributes.themes must be defined");
  assert.equal(themes.length, 2, "Expected exactly 2 themes");

  const defaultDark = themes.find((t) => t.id === "ghost.theme.default.dark");
  const tokyoNight = themes.find((t) => t.id === "ghost.theme.tokyo-night");

  assert.ok(defaultDark, "Default Dark theme must exist");
  assert.equal(defaultDark.name, "Default Dark");
  assert.equal(defaultDark.mode, "dark");

  assert.ok(tokyoNight, "Tokyo Night theme must exist");
  assert.equal(tokyoNight.name, "Tokyo Night");
  assert.equal(tokyoNight.mode, "dark");
});

// ---------------------------------------------------------------------------
// Default Dark palette completeness
// ---------------------------------------------------------------------------

test("Default Dark theme has full explicit palette values", () => {
  const defaultDark = pluginContract.contributes?.themes?.find(
    (t) => t.id === "ghost.theme.default.dark",
  );
  assert.ok(defaultDark);

  const { palette } = defaultDark;
  assert.equal(palette.background, "#14161a");
  assert.equal(palette.foreground, "#e9edf3");
  assert.equal(palette.primary, "#7cb4ff");
  assert.equal(palette.surface, "#121922");
  assert.equal(palette.border, "#334564");
  assert.equal(palette.error, "#8b3030");
  assert.equal(palette.warning, "#f2a65a");
  assert.equal(palette.success, "#22c55e");
  assert.equal(palette.info, "#3b82f6");
});

// ---------------------------------------------------------------------------
// Tokyo Night minimal palette + terminal colors
// ---------------------------------------------------------------------------

test("Tokyo Night theme uses minimal Omarchy-compatible palette (5 values)", () => {
  const tokyoNight = pluginContract.contributes?.themes?.find(
    (t) => t.id === "ghost.theme.tokyo-night",
  );
  assert.ok(tokyoNight);

  const { palette } = tokyoNight;

  // Only 5 palette values defined
  const definedKeys = Object.keys(palette);
  assert.equal(definedKeys.length, 5, "Tokyo Night should have exactly 5 palette values");
  assert.ok(palette.background, "background must be defined");
  assert.ok(palette.foreground, "foreground must be defined");
  assert.ok(palette.accent, "accent must be defined");
  assert.ok(palette.cursor, "cursor must be defined");
  assert.ok(palette.selectionBackground, "selectionBackground must be defined");

  // Has no explicit primary, surface, border, etc.
  assert.equal(palette.primary, undefined, "primary should not be set explicitly");
  assert.equal(palette.surface, undefined, "surface should not be set explicitly");
  assert.equal(palette.border, undefined, "border should not be set explicitly");
});

test("Tokyo Night theme has 16 terminal colors", () => {
  const tokyoNight = pluginContract.contributes?.themes?.find(
    (t) => t.id === "ghost.theme.tokyo-night",
  );
  assert.ok(tokyoNight);
  assert.ok(tokyoNight.terminal, "terminal palette must be defined");

  const terminalKeys = Object.keys(tokyoNight.terminal);
  assert.equal(terminalKeys.length, 16, "Expected all 16 ANSI terminal colors");
  assert.equal(tokyoNight.terminal.color0, "#32344a");
  assert.equal(tokyoNight.terminal.color1, "#f7768e");
  assert.equal(tokyoNight.terminal.color15, "#acb0d0");
});

// ---------------------------------------------------------------------------
// Derivation produces a complete palette from Tokyo Night's minimal input
// ---------------------------------------------------------------------------

test("deriveFullPalette fills all gaps for Tokyo Night minimal palette", () => {
  const tokyoNight = pluginContract.contributes?.themes?.find(
    (t) => t.id === "ghost.theme.tokyo-night",
  );
  assert.ok(tokyoNight);

  const derived = deriveFullPalette(tokyoNight.palette, tokyoNight.terminal);

  // Verify all 40 tokens are present
  assert.equal(derived.mode, "dark");
  assert.equal(derived.background, "#1a1b26");
  assert.equal(derived.foreground, "#a9b1d6");
  assert.equal(derived.accent, "#7aa2f7");
  assert.equal(derived.cursor, "#c0caf5");
  assert.equal(derived.selectionBackground, "#7aa2f7");

  // Derived from accent (since no explicit primary)
  assert.equal(derived.primary, "#7aa2f7");

  // Terminal-derived semantics (Omarchy compat)
  assert.equal(derived.error, "#f7768e", "error should come from terminal color1");
  assert.equal(derived.success, "#9ece6a", "success should come from terminal color2");
  assert.equal(derived.warning, "#e0af68", "warning should come from terminal color3");
  assert.equal(derived.info, "#449dab", "info should come from terminal color6");

  // Surface should be derived from background
  assert.ok(derived.surface, "surface must be derived");
  assert.ok(derived.overlay, "overlay must be derived");
  assert.ok(derived.muted, "muted must be derived");
  assert.ok(derived.border, "border must be derived");
  assert.ok(derived.ring, "ring must be derived");

  // All 22 derived tokens should be present
  assert.ok(derived.surfaceForeground, "surfaceForeground must be derived");
  assert.ok(derived.overlayForeground, "overlayForeground must be derived");
  assert.ok(derived.primaryForeground, "primaryForeground must be derived");
  assert.ok(derived.secondaryForeground, "secondaryForeground must be derived");
  assert.ok(derived.accentForeground, "accentForeground must be derived");
  assert.ok(derived.mutedForeground, "mutedForeground must be derived");
  assert.ok(derived.input, "input must be derived");
  assert.ok(derived.selectionForeground, "selectionForeground must be derived");
  assert.ok(derived.hoverBackground, "hoverBackground must be derived");
  assert.ok(derived.activeBackground, "activeBackground must be derived");
  assert.ok(derived.sidebar, "sidebar must be derived");
  assert.ok(derived.sidebarForeground, "sidebarForeground must be derived");
  assert.ok(derived.sidebarBorder, "sidebarBorder must be derived");
  assert.ok(derived.radius, "radius must be derived");
});
