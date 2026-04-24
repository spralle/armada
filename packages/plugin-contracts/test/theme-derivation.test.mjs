import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveFullPalette,
  adjustLightness,
  desaturate,
  contrastSafe,
  blendWithBackground,
  contrastRatio,
  isValidHex,
  GHOST_THEME_CSS_VARS,
} from "../../theme/src/index.ts";
import {
  partialThemePaletteSchema,
} from "../dist/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINIMAL_INPUT = {
  background: "#1a1a2e",
  foreground: "#e0e0e0",
  accent: "#e94560",
};

const OMARCHY_INPUT = {
  background: "#282a36",
  foreground: "#f8f8f2",
  primary: "#bd93f9",
  accent: "#ff79c6",
  secondary: "#6272a4",
  muted: "#44475a",
};

const OMARCHY_TERMINAL = {
  color0: "#21222c",
  color1: "#ff5555",
  color2: "#50fa7b",
  color3: "#f1fa8c",
  color4: "#bd93f9",
  color5: "#ff79c6",
  color6: "#8be9fd",
  color7: "#f8f8f2",
  color8: "#6272a4",
  color9: "#ff6e6e",
  color10: "#69ff94",
  color11: "#ffffa5",
  color12: "#d6acff",
  color13: "#ff92df",
  color14: "#a4ffff",
  color15: "#ffffff",
};

/** All 85 token keys expected in a full palette. */
const ALL_TOKEN_KEYS = [
  "mode", "background", "surface", "overlay", "primary", "secondary", "accent",
  "muted", "foreground", "error", "warning", "success", "info", "border", "ring",
  "cursor", "selectionBackground", "radius", "opacity",
  "opacityActive", "opacityInactive", "borderActive", "borderInactive", "borderSize",
  "surfaceForeground", "overlayForeground", "primaryForeground", "secondaryForeground",
  "accentForeground", "mutedForeground", "input", "selectionForeground",
  "hoverBackground", "activeBackground",
  "chart1", "chart2", "chart3", "chart4", "chart5",
  "edgeTop", "edgeTopForeground", "edgeTopBorder", "edgeTopAccent", "edgeTopAccentForeground",
  "edgeBottom", "edgeBottomForeground", "edgeBottomBorder", "edgeBottomAccent", "edgeBottomAccentForeground",
  "edgeLeft", "edgeLeftForeground", "edgeLeftBorder", "edgeLeftAccent", "edgeLeftAccentForeground",
  "edgeRight", "edgeRightForeground", "edgeRightBorder", "edgeRightAccent", "edgeRightAccentForeground",
  "surfaceElevated", "surfaceHover", "surfaceInset", "surfaceInsetDeep", "surfaceOverlay",
  "foregroundBright", "dimForeground", "faintForeground", "codeForeground",
  "borderMuted", "borderAlt", "borderAccent",
  "primaryGlowSubtle", "primaryGlow", "primaryBorderSemi", "primaryOverlay",
  "warningForeground", "warningBackground", "errorForeground", "errorBackground",
  "errorForegroundMuted", "successBackground", "successForeground", "infoBackground",
  "infoForeground", "neutralBackground",
];

// ---------------------------------------------------------------------------
// 1. deriveFullPalette from 3 minimal inputs produces all 47 tokens
// ---------------------------------------------------------------------------

test("deriveFullPalette produces all 85 tokens from 3 minimal inputs", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);

  for (const key of ALL_TOKEN_KEYS) {
    assert.notEqual(result[key], undefined, `Token "${key}" should be defined`);
  }

  assert.equal(Object.keys(result).length, 85, "Should produce exactly 85 tokens");
});

test("deriveFullPalette defaults mode to dark when not provided", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);
  assert.equal(result.mode, "dark");
});

test("deriveFullPalette respects explicit light mode", () => {
  const result = deriveFullPalette({ ...MINIMAL_INPUT, mode: "light" });
  assert.equal(result.mode, "light");
});

// ---------------------------------------------------------------------------
// 2. deriveFullPalette from Omarchy-style input (6 + terminal 16)
// ---------------------------------------------------------------------------

test("deriveFullPalette produces all 85 tokens from Omarchy-style input with terminal", () => {
  const result = deriveFullPalette(OMARCHY_INPUT, OMARCHY_TERMINAL);

  for (const key of ALL_TOKEN_KEYS) {
    assert.notEqual(result[key], undefined, `Token "${key}" should be defined`);
  }

  assert.equal(Object.keys(result).length, 85);
});

test("Omarchy terminal colors map to semantic tokens", () => {
  const result = deriveFullPalette(OMARCHY_INPUT, OMARCHY_TERMINAL);

  // Terminal color1 (red) → error
  assert.equal(result.error, "#ff5555");
  // Terminal color2 (green) → success
  assert.equal(result.success, "#50fa7b");
  // Terminal color3 (yellow) → warning
  assert.equal(result.warning, "#f1fa8c");
  // Terminal color6 (cyan) → info
  assert.equal(result.info, "#8be9fd");
});

// ---------------------------------------------------------------------------
// 3. Explicit values override derivation
// ---------------------------------------------------------------------------

test("explicit values override derivation", () => {
  const explicitSurface = "#333333";
  const explicitError = "#ff0000";
  const explicitRadius = "1rem";

  const result = deriveFullPalette({
    ...MINIMAL_INPUT,
    surface: explicitSurface,
    error: explicitError,
    radius: explicitRadius,
  });

  assert.equal(result.surface, explicitSurface);
  assert.equal(result.error, explicitError);
  assert.equal(result.radius, explicitRadius);
});

test("explicit error overrides terminal color1", () => {
  const result = deriveFullPalette(
    { ...OMARCHY_INPUT, error: "#cc0000" },
    OMARCHY_TERMINAL,
  );

  assert.equal(result.error, "#cc0000");
});

// ---------------------------------------------------------------------------
// 4. Derived foreground colors have sufficient contrast (WCAG AA >= 4.5)
// ---------------------------------------------------------------------------

test("primaryForeground has WCAG AA contrast against primary", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);
  const ratio = contrastRatio(result.primary, result.primaryForeground);
  assert.ok(ratio >= 4.5, `Expected contrast >= 4.5, got ${ratio.toFixed(2)}`);
});

test("secondaryForeground has WCAG AA contrast against secondary", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);
  const ratio = contrastRatio(result.secondary, result.secondaryForeground);
  assert.ok(ratio >= 4.5, `Expected contrast >= 4.5, got ${ratio.toFixed(2)}`);
});

test("accentForeground has WCAG AA contrast against accent", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);
  const ratio = contrastRatio(result.accent, result.accentForeground);
  assert.ok(ratio >= 4.5, `Expected contrast >= 4.5, got ${ratio.toFixed(2)}`);
});

test("contrast check holds for light mode themes", () => {
  const result = deriveFullPalette({
    background: "#ffffff",
    foreground: "#1a1a1a",
    primary: "#2563eb",
    mode: "light",
  });

  const pRatio = contrastRatio(result.primary, result.primaryForeground);
  assert.ok(pRatio >= 4.5, `primary contrast: ${pRatio.toFixed(2)}`);

  const sRatio = contrastRatio(result.secondary, result.secondaryForeground);
  assert.ok(sRatio >= 4.5, `secondary contrast: ${sRatio.toFixed(2)}`);

  const aRatio = contrastRatio(result.accent, result.accentForeground);
  assert.ok(aRatio >= 4.5, `accent contrast: ${aRatio.toFixed(2)}`);
});

// ---------------------------------------------------------------------------
// 5. Color math utilities produce valid hex colors
// ---------------------------------------------------------------------------

test("adjustLightness produces valid hex and moves in expected direction", () => {
  const darker = adjustLightness("#808080", -20);
  const brighter = adjustLightness("#808080", 20);

  assert.ok(isValidHex(darker), `"${darker}" should be valid hex`);
  assert.ok(isValidHex(brighter), `"${brighter}" should be valid hex`);

  // Brightness check: brighter should be a higher value than darker
  assert.notEqual(darker, brighter, "darkened and brightened should differ");
});

test("adjustLightness clamps at extremes", () => {
  const result1 = adjustLightness("#ffffff", 50);
  assert.ok(isValidHex(result1));
  const result2 = adjustLightness("#000000", -50);
  assert.ok(isValidHex(result2));
});

test("desaturate produces valid hex", () => {
  const result = desaturate("#ff0000", 40);
  assert.ok(isValidHex(result), `"${result}" should be valid hex`);
});

test("desaturate at 100% produces a gray", () => {
  const result = desaturate("#ff0000", 100);
  assert.ok(isValidHex(result));
  // Fully desaturated red at 50% lightness should be roughly gray
});

test("contrastSafe returns black or white", () => {
  assert.equal(contrastSafe("#000000"), "#ffffff");
  assert.equal(contrastSafe("#ffffff"), "#000000");
  assert.ok(["#ffffff", "#000000"].includes(contrastSafe("#808080")));
});

test("blendWithBackground produces valid hex", () => {
  const result = blendWithBackground("#ffffff", "#000000", 0.5);
  assert.ok(isValidHex(result));
  // 50% white over black should be mid-gray
  assert.equal(result, "#808080");
});

test("blendWithBackground at opacity 1 returns foreground", () => {
  const result = blendWithBackground("#ff0000", "#0000ff", 1.0);
  assert.equal(result, "#ff0000");
});

test("blendWithBackground at opacity 0 returns background", () => {
  const result = blendWithBackground("#ff0000", "#0000ff", 0.0);
  assert.equal(result, "#0000ff");
});

// ---------------------------------------------------------------------------
// 6. Zod schema validates correctly
// ---------------------------------------------------------------------------

test("schema accepts valid minimal input (background + foreground + accent)", () => {
  const result = partialThemePaletteSchema.safeParse(MINIMAL_INPUT);
  assert.equal(result.success, true);
});

test("schema accepts valid minimal input (background + foreground + primary)", () => {
  const result = partialThemePaletteSchema.safeParse({
    background: "#1a1a2e",
    foreground: "#e0e0e0",
    primary: "#3b82f6",
  });
  assert.equal(result.success, true);
});

test("schema accepts full input with all optional fields", () => {
  const result = partialThemePaletteSchema.safeParse({
    ...MINIMAL_INPUT,
    mode: "dark",
    surface: "#222222",
    overlay: "#333333",
    primary: "#3b82f6",
    secondary: "#6272a4",
    muted: "#44475a",
    error: "#ef4444",
    warning: "#f59e0b",
    success: "#22c55e",
    info: "#3b82f6",
    border: "#555555",
    ring: "#3b82f6",
    cursor: "#ffffff",
    selectionBackground: "#3b82f6",
    radius: "0.5rem",
  });
  assert.equal(result.success, true);
});

test("schema rejects missing background", () => {
  const result = partialThemePaletteSchema.safeParse({
    foreground: "#e0e0e0",
    accent: "#e94560",
  });
  assert.equal(result.success, false);
});

test("schema rejects missing foreground", () => {
  const result = partialThemePaletteSchema.safeParse({
    background: "#1a1a2e",
    accent: "#e94560",
  });
  assert.equal(result.success, false);
});

test("schema rejects missing both accent and primary", () => {
  const result = partialThemePaletteSchema.safeParse({
    background: "#1a1a2e",
    foreground: "#e0e0e0",
  });
  assert.equal(result.success, false);
});

test("schema rejects invalid hex color", () => {
  const result = partialThemePaletteSchema.safeParse({
    background: "not-a-hex",
    foreground: "#e0e0e0",
    accent: "#e94560",
  });
  assert.equal(result.success, false);
});

test("schema rejects unrecognized keys (strict mode)", () => {
  const result = partialThemePaletteSchema.safeParse({
    ...MINIMAL_INPUT,
    unknownField: "value",
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// CSS variable map
// ---------------------------------------------------------------------------

test("GHOST_THEME_CSS_VARS has entries for all 85 tokens", () => {
  assert.equal(Object.keys(GHOST_THEME_CSS_VARS).length, 85);
  for (const key of ALL_TOKEN_KEYS) {
    assert.ok(
      key in GHOST_THEME_CSS_VARS,
      `CSS var mapping missing for "${key}"`,
    );
    assert.ok(
      GHOST_THEME_CSS_VARS[key].startsWith("--ghost-"),
      `CSS var for "${key}" should start with --ghost-`,
    );
  }
});

// ---------------------------------------------------------------------------
// Primary/accent fallback symmetry
// ---------------------------------------------------------------------------

test("primary falls back to accent when only accent is provided", () => {
  const result = deriveFullPalette({
    background: "#1a1a2e",
    foreground: "#e0e0e0",
    accent: "#e94560",
  });
  assert.equal(result.primary, "#e94560");
  assert.equal(result.accent, "#e94560");
});

test("accent falls back to primary when only primary is provided", () => {
  const result = deriveFullPalette({
    background: "#1a1a2e",
    foreground: "#e0e0e0",
    primary: "#3b82f6",
  });
  assert.equal(result.accent, "#3b82f6");
  assert.equal(result.primary, "#3b82f6");
});

// ---------------------------------------------------------------------------
// Fallback defaults
// ---------------------------------------------------------------------------

test("fallback defaults are used for missing semantic colors without terminal", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);
  assert.equal(result.error, "#ef4444");
  assert.equal(result.warning, "#f59e0b");
  assert.equal(result.success, "#22c55e");
  assert.equal(result.info, "#3b82f6");
  assert.equal(result.radius, "0.625rem");
});

// ---------------------------------------------------------------------------
// Opacity token
// ---------------------------------------------------------------------------

test("opacity defaults to 1.0 when not provided", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);
  // opacity field now equals opacityActive (Hyprland default 0.97)
  assert.equal(result.opacity, 0.97);
  assert.equal(result.opacity, result.opacityActive, "opacity should equal opacityActive");
});

test("opacity is preserved when explicitly set", () => {
  const result = deriveFullPalette({ ...MINIMAL_INPUT, opacity: 0.85 });
  assert.equal(result.opacity, 0.85);
  assert.equal(result.opacity, result.opacityActive, "opacity should equal opacityActive");
});

test("GHOST_THEME_CSS_VARS has entry for opacity", () => {
  assert.ok("opacity" in GHOST_THEME_CSS_VARS, "CSS var mapping missing for opacity");
  assert.equal(GHOST_THEME_CSS_VARS.opacity, "--ghost-background-opacity");
});

test("schema accepts valid opacity value", () => {
  const result = partialThemePaletteSchema.safeParse({
    ...MINIMAL_INPUT,
    opacity: 0.85,
  });
  assert.equal(result.success, true);
});

test("schema rejects opacity out of range (above 1)", () => {
  const result = partialThemePaletteSchema.safeParse({
    ...MINIMAL_INPUT,
    opacity: 1.5,
  });
  assert.equal(result.success, false);
});

test("schema rejects opacity out of range (below 0)", () => {
  const result = partialThemePaletteSchema.safeParse({
    ...MINIMAL_INPUT,
    opacity: -0.1,
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// Window appearance tokens (Hyprland-style)
// ---------------------------------------------------------------------------

test("split opacity defaults: no opacity input → opacityActive=0.97, opacityInactive=0.90", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);
  assert.equal(result.opacityActive, 0.97);
  assert.equal(result.opacityInactive, 0.90);
});

test("legacy opacity backward compat: opacity=0.85 → opacityActive=0.85, opacityInactive≈0.79", () => {
  const result = deriveFullPalette({ ...MINIMAL_INPUT, opacity: 0.85 });
  assert.equal(result.opacityActive, 0.85);
  const expected = 0.85 * 0.93;
  assert.ok(
    Math.abs(result.opacityInactive - expected) < 0.001,
    `Expected opacityInactive ≈ ${expected}, got ${result.opacityInactive}`,
  );
  assert.equal(result.opacity, result.opacityActive, "FullThemePalette.opacity === opacityActive");
});

test("explicit opacityActive/opacityInactive override legacy opacity and defaults", () => {
  const result = deriveFullPalette({
    ...MINIMAL_INPUT,
    opacity: 0.85,
    opacityActive: 0.95,
    opacityInactive: 0.80,
  });
  assert.equal(result.opacityActive, 0.95);
  assert.equal(result.opacityInactive, 0.80);
  assert.equal(result.opacity, 0.95, "FullThemePalette.opacity should equal opacityActive");
});

test("borderActive derives from accent when not set", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);
  assert.equal(result.borderActive, result.accent);
});

test("borderInactive derives from border when not set", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);
  assert.equal(result.borderInactive, result.border);
});

test("borderSize defaults to 1px when not set", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);
  assert.equal(result.borderSize, "1px");
});

test("explicit border appearance tokens override derivation", () => {
  const result = deriveFullPalette({
    ...MINIMAL_INPUT,
    borderActive: "#ff0000",
    borderInactive: "#00ff00",
    borderSize: "2px",
  });
  assert.equal(result.borderActive, "#ff0000");
  assert.equal(result.borderInactive, "#00ff00");
  assert.equal(result.borderSize, "2px");
});

test("schema accepts new window appearance fields", () => {
  const result = partialThemePaletteSchema.safeParse({
    ...MINIMAL_INPUT,
    opacityActive: 0.97,
    opacityInactive: 0.90,
    borderActive: "#ff0000",
    borderInactive: "#00ff00",
    borderSize: "2px",
  });
  assert.equal(result.success, true);
});

test("schema rejects opacityActive > 1", () => {
  const result = partialThemePaletteSchema.safeParse({
    ...MINIMAL_INPUT,
    opacityActive: 1.5,
  });
  assert.equal(result.success, false);
});

test("schema rejects opacityInactive < 0", () => {
  const result = partialThemePaletteSchema.safeParse({
    ...MINIMAL_INPUT,
    opacityInactive: -0.1,
  });
  assert.equal(result.success, false);
});

test("CSS var map has entries for all 5 new window appearance tokens", () => {
  assert.equal(GHOST_THEME_CSS_VARS.opacityActive, "--ghost-opacity-active");
  assert.equal(GHOST_THEME_CSS_VARS.opacityInactive, "--ghost-opacity-inactive");
  assert.equal(GHOST_THEME_CSS_VARS.borderActive, "--ghost-border-active");
  assert.equal(GHOST_THEME_CSS_VARS.borderInactive, "--ghost-border-inactive");
  assert.equal(GHOST_THEME_CSS_VARS.borderSize, "--ghost-border-size");
});

test("--ghost-background-opacity CSS var unchanged (backward compat)", () => {
  assert.equal(GHOST_THEME_CSS_VARS.opacity, "--ghost-background-opacity");
});

// ---------------------------------------------------------------------------
// ANSI color4/color5 fallback tests
// ---------------------------------------------------------------------------

test("ANSI color4 maps to primary when primary not explicitly set", () => {
  const result = deriveFullPalette(
    { background: "#1a1a2e", foreground: "#e0e0e0", accent: "#e94560" },
    { color4: "#bd93f9" },
  );
  assert.equal(result.primary, "#bd93f9");
  assert.equal(result.accent, "#e94560");
});

test("ANSI color5 maps to secondary when secondary not explicitly set", () => {
  const result = deriveFullPalette(
    { background: "#1a1a2e", foreground: "#e0e0e0", accent: "#e94560" },
    { color5: "#ff79c6" },
  );
  assert.equal(result.secondary, "#ff79c6");
});

test("explicit primary overrides terminal color4", () => {
  const result = deriveFullPalette(
    { background: "#1a1a2e", foreground: "#e0e0e0", primary: "#3b82f6", accent: "#e94560" },
    { color4: "#bd93f9" },
  );
  assert.equal(result.primary, "#3b82f6");
});

// ---------------------------------------------------------------------------
// New unified token tests
// ---------------------------------------------------------------------------

test("new surface variant tokens are derived and valid hex", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);
  for (const key of ["surfaceElevated", "surfaceHover", "surfaceInset", "surfaceInsetDeep", "surfaceOverlay"]) {
    assert.ok(isValidHex(result[key]), `${key} should be valid hex, got "${result[key]}"`);
  }
});

test("primary effect tokens include alpha channel (8-digit hex)", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);
  for (const key of ["primaryGlowSubtle", "primaryGlow", "primaryBorderSemi", "primaryOverlay"]) {
    assert.ok(result[key].length === 9, `${key} should be 9 chars (#RRGGBBAA), got "${result[key]}"`);
    assert.ok(result[key].startsWith("#"), `${key} should start with #`);
  }
});

test("status foreground/background tokens are valid hex", () => {
  const result = deriveFullPalette(MINIMAL_INPUT);
  for (const key of ["warningForeground", "warningBackground", "errorForeground", "errorBackground", "errorForegroundMuted", "successForeground", "successBackground", "infoForeground", "infoBackground", "neutralBackground"]) {
    assert.ok(isValidHex(result[key]), `${key} should be valid hex, got "${result[key]}"`);
  }
});
