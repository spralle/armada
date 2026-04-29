/**
 * Derive a complete 73-token palette from a partial input.
 * Terminal palette (Omarchy compat) maps ANSI colors to semantic tokens
 * when those tokens are not explicitly set. Pure function — no side effects.
 */
import type { FullThemePalette, PartialThemePalette, TerminalPalette } from "@ghost-shell/contracts/theme";
import { adjustLightness, blendWithBackground, contrastSafe } from "./color-utils.js";
import {
  deriveBorderVariants,
  deriveForegroundVariants,
  derivePrimaryEffects,
  deriveStatusTokens,
  deriveSurfaceVariants,
  resolveCoreTokens,
} from "./derivation-helpers.js";

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
    mode: core.mode,
    background,
    foreground,
    surface: core.surface,
    overlay: core.overlay,
    primary: core.primary,
    secondary: core.secondary,
    accent: core.accent,
    muted: core.muted,
    error: core.error,
    warning: core.warning,
    success: core.success,
    info: core.info,
    border: core.border,
    ring: core.ring,
    cursor: core.cursor,
    selectionBackground: core.selectionBackground,
    radius: core.radius,
    opacity: core.opacityActive,
    opacityActive: core.opacityActive,
    opacityInactive: core.opacityInactive,
    borderActive: core.borderActive,
    borderInactive: core.borderInactive,
    borderSize: core.borderSize,
    surfaceForeground: foreground,
    overlayForeground: foreground,
    primaryForeground: primaryFg,
    secondaryForeground: contrastSafe(core.secondary),
    accentForeground: contrastSafe(core.accent),
    mutedForeground: blendWithBackground(foreground, background, 0.6),
    input: core.border,
    selectionForeground: foreground,
    hoverBackground: adjustLightness(core.surface, sign * 3),
    activeBackground: adjustLightness(core.surface, sign * 6),
    chart1: core.primary,
    chart2: core.secondary,
    chart3: core.accent,
    chart4: core.success,
    chart5: core.warning,
    // Edge slot tokens (top, bottom, left, right)
    edgeTop: adjustLightness(core.surface, sign * -3),
    edgeTopForeground: foreground,
    edgeTopBorder: core.border,
    edgeTopAccent: core.accent,
    edgeTopAccentForeground: contrastSafe(core.accent),
    edgeBottom: adjustLightness(core.surface, sign * -3),
    edgeBottomForeground: foreground,
    edgeBottomBorder: core.border,
    edgeBottomAccent: core.accent,
    edgeBottomAccentForeground: contrastSafe(core.accent),
    edgeLeft: adjustLightness(core.surface, sign * -3),
    edgeLeftForeground: foreground,
    edgeLeftBorder: core.border,
    edgeLeftAccent: core.accent,
    edgeLeftAccentForeground: contrastSafe(core.accent),
    edgeRight: adjustLightness(core.surface, sign * -3),
    edgeRightForeground: foreground,
    edgeRightBorder: core.border,
    edgeRightAccent: core.accent,
    edgeRightAccentForeground: contrastSafe(core.accent),
    ...surfaceVars,
    ...fgVars,
    ...borderVars,
    ...primaryFx,
    ...statusVars,
    neutralBackground: adjustLightness(background, sign * 12),
  };
}
