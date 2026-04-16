/**
 * Theme palette type definitions, Zod schemas, derivation engine, and CSS variable map.
 *
 * Pure data/logic — no UI, no DOM, no side effects.
 */
import { z } from "zod";

import {
  adjustLightness,
  blendWithBackground,
  contrastSafe,
  isValidHex,
} from "./theme-color-utils.js";

import {
  resolveCoreTokens,
  deriveSurfaceVariants,
  deriveForegroundVariants,
  deriveBorderVariants,
  derivePrimaryEffects,
  deriveStatusTokens,
} from "./theme-derivation-helpers.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThemeMode = "dark" | "light";

/** The 16 ANSI terminal colors (color0–color15). */
export interface TerminalPalette {
  color0?: string | undefined;
  color1?: string | undefined;
  color2?: string | undefined;
  color3?: string | undefined;
  color4?: string | undefined;
  color5?: string | undefined;
  color6?: string | undefined;
  color7?: string | undefined;
  color8?: string | undefined;
  color9?: string | undefined;
  color10?: string | undefined;
  color11?: string | undefined;
  color12?: string | undefined;
  color13?: string | undefined;
  color14?: string | undefined;
  color15?: string | undefined;
}

/**
 * Partial theme palette — the input shape for theme plugins.
 * Only `background`, `foreground`, and at least one of `accent`/`primary` are required.
 */
export interface PartialThemePalette {
  mode?: ThemeMode | undefined;
  background: string;
  foreground: string;
  surface?: string | undefined;
  overlay?: string | undefined;
  primary?: string | undefined;
  secondary?: string | undefined;
  accent?: string | undefined;
  muted?: string | undefined;
  error?: string | undefined;
  warning?: string | undefined;
  success?: string | undefined;
  info?: string | undefined;
  border?: string | undefined;
  ring?: string | undefined;
  cursor?: string | undefined;
  selectionBackground?: string | undefined;
  radius?: string | undefined;
  opacity?: number | undefined;
  opacityActive?: number | undefined;
  opacityInactive?: number | undefined;
  borderActive?: string | undefined;
  borderInactive?: string | undefined;
  borderSize?: string | undefined;
}

/**
 * Full 73-token theme palette — the output of derivation.
 * Every field is guaranteed present.
 */
export interface FullThemePalette {
  // 18 core tokens
  mode: ThemeMode;
  background: string;
  surface: string;
  overlay: string;
  primary: string;
  secondary: string;
  accent: string;
  muted: string;
  foreground: string;
  error: string;
  warning: string;
  success: string;
  info: string;
  border: string;
  ring: string;
  cursor: string;
  selectionBackground: string;
  radius: string;
  opacity: number;
  // 5 window appearance tokens (Hyprland-style)
  opacityActive: number;
  opacityInactive: number;
  borderActive: string;
  borderInactive: string;
  borderSize: string;
  // 22 derived tokens
  surfaceForeground: string;
  overlayForeground: string;
  primaryForeground: string;
  secondaryForeground: string;
  accentForeground: string;
  mutedForeground: string;
  input: string;
  selectionForeground: string;
  hoverBackground: string;
  activeBackground: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  // Surface variants (derived from surface)
  surfaceElevated: string;
  surfaceHover: string;
  surfaceInset: string;
  surfaceInsetDeep: string;
  surfaceOverlay: string;
  // Foreground variants (derived from foreground + background)
  foregroundBright: string;
  dimForeground: string;
  faintForeground: string;
  codeForeground: string;
  // Border variants (derived from border)
  borderMuted: string;
  borderAlt: string;
  borderAccent: string;
  // Primary effect tokens (primary + alpha channel)
  primaryGlowSubtle: string;
  primaryGlow: string;
  primaryBorderSemi: string;
  primaryOverlay: string;
  // Semantic status foreground/background pairs
  warningForeground: string;
  warningBackground: string;
  errorForeground: string;
  errorBackground: string;
  errorForegroundMuted: string;
  successBackground: string;
  successForeground: string;
  infoBackground: string;
  infoForeground: string;
  // Neutral
  neutralBackground: string;
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const hexColorString = z
  .string()
  .trim()
  .refine((v) => isValidHex(v), { message: "Must be a valid hex color (#RGB or #RRGGBB)" });

export const terminalPaletteSchema = z.object({
  color0: hexColorString.optional(),
  color1: hexColorString.optional(),
  color2: hexColorString.optional(),
  color3: hexColorString.optional(),
  color4: hexColorString.optional(),
  color5: hexColorString.optional(),
  color6: hexColorString.optional(),
  color7: hexColorString.optional(),
  color8: hexColorString.optional(),
  color9: hexColorString.optional(),
  color10: hexColorString.optional(),
  color11: hexColorString.optional(),
  color12: hexColorString.optional(),
  color13: hexColorString.optional(),
  color14: hexColorString.optional(),
  color15: hexColorString.optional(),
});

export const partialThemePaletteSchema = z
  .object({
    mode: z.enum(["dark", "light"]).optional(),
    background: hexColorString,
    foreground: hexColorString,
    surface: hexColorString.optional(),
    overlay: hexColorString.optional(),
    primary: hexColorString.optional(),
    secondary: hexColorString.optional(),
    accent: hexColorString.optional(),
    muted: hexColorString.optional(),
    error: hexColorString.optional(),
    warning: hexColorString.optional(),
    success: hexColorString.optional(),
    info: hexColorString.optional(),
    border: hexColorString.optional(),
    ring: hexColorString.optional(),
    cursor: hexColorString.optional(),
    selectionBackground: hexColorString.optional(),
    radius: z.string().trim().min(1).optional(),
    opacity: z.number().min(0).max(1).optional(),
    opacityActive: z.number().min(0).max(1).optional(),
    opacityInactive: z.number().min(0).max(1).optional(),
    borderActive: hexColorString.optional(),
    borderInactive: hexColorString.optional(),
    borderSize: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((data) => data.accent !== undefined || data.primary !== undefined, {
    message: "At least one of 'accent' or 'primary' must be provided",
    path: ["accent"],
  });

// ---------------------------------------------------------------------------
// Derivation engine
// ---------------------------------------------------------------------------

/**
 * Derive a complete 73-token palette from a partial input.
 * Terminal palette (Omarchy compat) maps ANSI colors to semantic tokens
 * when those tokens are not explicitly set. Pure function — no side effects.
 */
export function deriveFullPalette(
  input: PartialThemePalette,
  terminal?: TerminalPalette | undefined,
): FullThemePalette {
  const core = resolveCoreTokens(input, terminal);
  const { sign } = core;

  const surfaceVars = deriveSurfaceVariants(core.surface, sign);
  const fgVars = deriveForegroundVariants(input.foreground, input.background, core.primary, sign);
  const borderVars = deriveBorderVariants(core.border, sign);
  const primaryFx = derivePrimaryEffects(core.primary);
  const statusVars = deriveStatusTokens(core.error, core.warning, core.success, core.info, input.background, sign);

  const { foreground, background } = input;
  const primaryFg = contrastSafe(core.primary);

  return {
    mode: core.mode, background, foreground,
    surface: core.surface, overlay: core.overlay,
    primary: core.primary, secondary: core.secondary,
    accent: core.accent, muted: core.muted,
    error: core.error, warning: core.warning, success: core.success, info: core.info,
    border: core.border, ring: core.ring,
    cursor: core.cursor, selectionBackground: core.selectionBackground,
    radius: core.radius, opacity: core.opacityActive,
    opacityActive: core.opacityActive, opacityInactive: core.opacityInactive,
    borderActive: core.borderActive, borderInactive: core.borderInactive, borderSize: core.borderSize,
    surfaceForeground: foreground, overlayForeground: foreground,
    primaryForeground: primaryFg,
    secondaryForeground: contrastSafe(core.secondary),
    accentForeground: contrastSafe(core.accent),
    mutedForeground: blendWithBackground(foreground, background, 0.6),
    input: core.border, selectionForeground: foreground,
    hoverBackground: adjustLightness(core.surface, sign * 3),
    activeBackground: adjustLightness(core.surface, sign * 6),
    chart1: core.primary, chart2: core.secondary, chart3: core.accent,
    chart4: core.success, chart5: core.warning,
    sidebar: adjustLightness(core.surface, sign * -3),
    sidebarForeground: foreground, sidebarPrimary: core.primary,
    sidebarPrimaryForeground: primaryFg, sidebarAccent: core.accent,
    sidebarAccentForeground: contrastSafe(core.accent),
    sidebarBorder: core.border, sidebarRing: core.ring,
    ...surfaceVars, ...fgVars, ...borderVars, ...primaryFx, ...statusVars,
    neutralBackground: adjustLightness(background, sign * 12),
  };
}
