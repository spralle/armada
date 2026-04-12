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
  desaturate,
  isValidHex,
} from "./theme-color-utils.js";

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
 * Full 47-token theme palette — the output of derivation.
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
// Fallback constants
// ---------------------------------------------------------------------------

const FALLBACK_ERROR = "#ef4444";
const FALLBACK_WARNING = "#f59e0b";
const FALLBACK_SUCCESS = "#22c55e";
const FALLBACK_INFO = "#3b82f6";
const FALLBACK_RADIUS = "0.625rem";

// ---------------------------------------------------------------------------
// Derivation engine
// ---------------------------------------------------------------------------

/**
 * Derive a complete 47-token palette from a partial input.
 * Terminal palette (Omarchy compat) maps color1→error, color2→success,
 * color3→warning, color6→info when those tokens are not explicitly set.
 *
 * This is a pure function — no side effects.
 */
export function deriveFullPalette(
  input: PartialThemePalette,
  terminal?: TerminalPalette | undefined,
): FullThemePalette {
  const mode: ThemeMode = input.mode ?? "dark";
  const isDark = mode === "dark";
  const sign = isDark ? 1 : -1;

  // Core accent/primary resolution
  const primary = input.primary ?? input.accent!;
  const accent = input.accent ?? input.primary!;

  // Terminal-derived semantic colors (Omarchy compat)
  const error = input.error ?? terminal?.color1 ?? FALLBACK_ERROR;
  const warning = input.warning ?? terminal?.color3 ?? FALLBACK_WARNING;
  const success = input.success ?? terminal?.color2 ?? FALLBACK_SUCCESS;
  const info = input.info ?? terminal?.color6 ?? FALLBACK_INFO;

  // Surface derivation
  const surface = input.surface ?? adjustLightness(input.background, sign * 6);
  const overlay = input.overlay ?? adjustLightness(input.background, sign * 10);
  const muted = input.muted ?? adjustLightness(input.background, sign * 3);
  const border = input.border ?? adjustLightness(input.background, sign * 15);
  const secondary = input.secondary ?? desaturate(primary, 40);
  const ring = input.ring ?? primary;
  const cursor = input.cursor ?? input.foreground;
  const selectionBackground = input.selectionBackground ?? primary;
  const radius = input.radius ?? FALLBACK_RADIUS;
  const opacity = input.opacity ?? 1.0;

  // Window appearance tokens (Hyprland-style split opacity + borders)
  const opacityActive = input.opacityActive ?? input.opacity ?? 0.97;
  const opacityInactive =
    input.opacityInactive ?? (input.opacity != null ? input.opacity * 0.93 : 0.90);
  const borderActive = input.borderActive ?? accent;
  const borderInactive = input.borderInactive ?? border;
  const borderSize = input.borderSize ?? "1px";

  // Derived foreground tokens
  const primaryForeground = contrastSafe(primary);
  const secondaryForeground = contrastSafe(secondary);
  const accentForeground = contrastSafe(accent);
  const mutedForeground = blendWithBackground(input.foreground, input.background, 0.6);

  // Derived surface tokens
  const hoverBackground = adjustLightness(surface, sign * 3);
  const activeBackground = adjustLightness(surface, sign * 6);

  // Chart tokens: spread across primary, secondary, accent, success, warning
  const chart1 = primary;
  const chart2 = secondary;
  const chart3 = accent;
  const chart4 = success;
  const chart5 = warning;

  // Sidebar tokens
  const sidebar = adjustLightness(surface, sign * -3);
  const sidebarForeground = input.foreground;
  const sidebarPrimary = primary;
  const sidebarPrimaryForeground = primaryForeground;
  const sidebarAccent = accent;
  const sidebarAccentForeground = accentForeground;
  const sidebarBorder = border;
  const sidebarRing = ring;

  return {
    mode,
    background: input.background,
    surface,
    overlay,
    primary,
    secondary,
    accent,
    muted,
    foreground: input.foreground,
    error,
    warning,
    success,
    info,
    border,
    ring,
    cursor,
    selectionBackground,
    radius,
    opacity: opacityActive,
    opacityActive,
    opacityInactive,
    borderActive,
    borderInactive,
    borderSize,
    surfaceForeground: input.foreground,
    overlayForeground: input.foreground,
    primaryForeground,
    secondaryForeground,
    accentForeground,
    mutedForeground,
    input: border,
    selectionForeground: input.foreground,
    hoverBackground,
    activeBackground,
    chart1,
    chart2,
    chart3,
    chart4,
    chart5,
    sidebar,
    sidebarForeground,
    sidebarPrimary,
    sidebarPrimaryForeground,
    sidebarAccent,
    sidebarAccentForeground,
    sidebarBorder,
    sidebarRing,
  };
}
