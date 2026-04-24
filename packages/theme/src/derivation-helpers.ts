/**
 * Extracted derivation helpers for theme palette derivation.
 *
 * Keeps the main module under the 350-line lint threshold
 * and each function under 50 lines.
 */
import type { PartialThemePalette, TerminalPalette, ThemeMode } from "@ghost-shell/contracts";
import {
  adjustLightness,
  blendWithBackground,
  desaturate,
  withAlpha,
} from "./color-utils.js";

// ---------------------------------------------------------------------------
// Fallback constants (co-located with the helpers that use them)
// ---------------------------------------------------------------------------

const FALLBACK_ERROR = "#ef4444";
const FALLBACK_WARNING = "#f59e0b";
const FALLBACK_SUCCESS = "#22c55e";
const FALLBACK_INFO = "#3b82f6";
const FALLBACK_RADIUS = "0.625rem";

// ---------------------------------------------------------------------------
// CoreTokens — intermediate resolution result
// ---------------------------------------------------------------------------

export interface CoreTokens {
  mode: ThemeMode;
  isDark: boolean;
  sign: number;
  primary: string;
  accent: string;
  secondary: string;
  surface: string;
  overlay: string;
  muted: string;
  border: string;
  ring: string;
  cursor: string;
  selectionBackground: string;
  radius: string;
  opacity: number;
  error: string;
  warning: string;
  success: string;
  info: string;
  opacityActive: number;
  opacityInactive: number;
  borderActive: string;
  borderInactive: string;
  borderSize: string;
}

/** Resolve all core tokens from partial input + optional terminal palette. */
export function resolveCoreTokens(
  input: PartialThemePalette,
  terminal: TerminalPalette | undefined,
): CoreTokens {
  const mode: ThemeMode = input.mode ?? "dark";
  const isDark = mode === "dark";
  const sign = isDark ? 1 : -1;

  const primary = input.primary ?? terminal?.color4 ?? input.accent!;
  const accent = input.accent ?? input.primary!;
  const secondary = input.secondary ?? terminal?.color5 ?? desaturate(primary, 40);

  const error = input.error ?? terminal?.color1 ?? FALLBACK_ERROR;
  const warning = input.warning ?? terminal?.color3 ?? FALLBACK_WARNING;
  const success = input.success ?? terminal?.color2 ?? FALLBACK_SUCCESS;
  const info = input.info ?? terminal?.color6 ?? FALLBACK_INFO;

  const surface = input.surface ?? adjustLightness(input.background, sign * 6);
  const overlay = input.overlay ?? adjustLightness(input.background, sign * 10);
  const muted = input.muted ?? adjustLightness(input.background, sign * 3);
  const border = input.border ?? adjustLightness(input.background, sign * 15);

  const opacityActive = input.opacityActive ?? input.opacity ?? 0.97;
  const opacityInactive =
    input.opacityInactive ?? (input.opacity != null ? input.opacity * 0.93 : 0.90);

  return {
    mode, isDark, sign, primary, accent, secondary,
    surface, overlay, muted, border,
    ring: input.ring ?? primary,
    cursor: input.cursor ?? input.foreground,
    selectionBackground: input.selectionBackground ?? primary,
    radius: input.radius ?? FALLBACK_RADIUS,
    opacity: input.opacity ?? 1.0,
    error, warning, success, info,
    opacityActive, opacityInactive,
    borderActive: input.borderActive ?? accent,
    borderInactive: input.borderInactive ?? border,
    borderSize: input.borderSize ?? "1px",
  };
}

// ---------------------------------------------------------------------------
// Variant derivation helpers
// ---------------------------------------------------------------------------

/** Derive surface variant tokens from the base surface color. */
export function deriveSurfaceVariants(
  surface: string,
  sign: number,
): { surfaceElevated: string; surfaceHover: string; surfaceInset: string; surfaceInsetDeep: string; surfaceOverlay: string } {
  return {
    surfaceElevated: adjustLightness(surface, sign * 6),
    surfaceHover: adjustLightness(surface, sign * 3),
    surfaceInset: adjustLightness(surface, sign * -6),
    surfaceInsetDeep: adjustLightness(surface, sign * -10),
    surfaceOverlay: adjustLightness(surface, sign * -3),
  };
}

/** Derive foreground variant tokens. */
export function deriveForegroundVariants(
  foreground: string,
  background: string,
  primary: string,
  sign: number,
): { foregroundBright: string; dimForeground: string; faintForeground: string; codeForeground: string } {
  return {
    foregroundBright: adjustLightness(foreground, sign * 5),
    dimForeground: blendWithBackground(foreground, background, 0.75),
    faintForeground: blendWithBackground(foreground, background, 0.65),
    codeForeground: adjustLightness(primary, sign * 15),
  };
}

/** Derive border variant tokens from the base border color. */
export function deriveBorderVariants(
  border: string,
  sign: number,
): { borderMuted: string; borderAlt: string; borderAccent: string } {
  return {
    borderMuted: adjustLightness(border, sign * -5),
    borderAlt: adjustLightness(border, sign * -3),
    borderAccent: adjustLightness(border, sign * 8),
  };
}

/** Derive primary glow/overlay effect tokens using alpha blending. */
export function derivePrimaryEffects(
  primary: string,
): { primaryGlowSubtle: string; primaryGlow: string; primaryBorderSemi: string; primaryOverlay: string } {
  return {
    primaryGlowSubtle: withAlpha(primary, 0.2),
    primaryGlow: withAlpha(primary, 0.27),
    primaryBorderSemi: withAlpha(primary, 0.53),
    primaryOverlay: withAlpha(primary, 0.18),
  };
}

interface StatusTokens {
  warningForeground: string;
  warningBackground: string;
  errorForeground: string;
  errorBackground: string;
  errorForegroundMuted: string;
  successForeground: string;
  successBackground: string;
  infoForeground: string;
  infoBackground: string;
}

/** Derive semantic status foreground/background pairs. */
export function deriveStatusTokens(
  error: string,
  warning: string,
  success: string,
  info: string,
  background: string,
  sign: number,
): StatusTokens {
  return {
    warningForeground: adjustLightness(warning, sign * 15),
    warningBackground: blendWithBackground(warning, background, 0.15),
    errorForeground: adjustLightness(error, sign * 25),
    errorBackground: blendWithBackground(error, background, 0.15),
    errorForegroundMuted: adjustLightness(error, sign * 15),
    successForeground: adjustLightness(success, sign * 15),
    successBackground: blendWithBackground(success, background, 0.15),
    infoForeground: adjustLightness(info, sign * 15),
    infoBackground: blendWithBackground(info, background, 0.15),
  };
}
