/**
 * CSS custom property mapping for Ghost theme tokens.
 *
 * Maps every palette token name to its `--ghost-*` CSS variable name.
 */
import type { FullThemePalette } from "@ghost-shell/contracts";

/** Maps every palette token name to its Ghost CSS custom property name. */
export const GHOST_THEME_CSS_VARS: Readonly<Record<keyof FullThemePalette, string>> = {
  mode: "--ghost-mode",
  background: "--ghost-background",
  surface: "--ghost-surface",
  overlay: "--ghost-overlay",
  primary: "--ghost-primary",
  secondary: "--ghost-secondary",
  accent: "--ghost-accent",
  muted: "--ghost-muted",
  foreground: "--ghost-foreground",
  error: "--ghost-error",
  warning: "--ghost-warning",
  success: "--ghost-success",
  info: "--ghost-info",
  border: "--ghost-border",
  ring: "--ghost-ring",
  cursor: "--ghost-cursor",
  selectionBackground: "--ghost-selection-background",
  radius: "--ghost-radius",
  opacity: "--ghost-background-opacity",
  surfaceForeground: "--ghost-surface-foreground",
  overlayForeground: "--ghost-overlay-foreground",
  primaryForeground: "--ghost-primary-foreground",
  secondaryForeground: "--ghost-secondary-foreground",
  accentForeground: "--ghost-accent-foreground",
  mutedForeground: "--ghost-muted-foreground",
  input: "--ghost-input",
  selectionForeground: "--ghost-selection-foreground",
  hoverBackground: "--ghost-hover-background",
  activeBackground: "--ghost-active-background",
  chart1: "--ghost-chart-1",
  chart2: "--ghost-chart-2",
  chart3: "--ghost-chart-3",
  chart4: "--ghost-chart-4",
  chart5: "--ghost-chart-5",
  edgeTop: "--ghost-edge-top",
  edgeTopForeground: "--ghost-edge-top-foreground",
  edgeTopBorder: "--ghost-edge-top-border",
  edgeTopAccent: "--ghost-edge-top-accent",
  edgeTopAccentForeground: "--ghost-edge-top-accent-foreground",
  edgeBottom: "--ghost-edge-bottom",
  edgeBottomForeground: "--ghost-edge-bottom-foreground",
  edgeBottomBorder: "--ghost-edge-bottom-border",
  edgeBottomAccent: "--ghost-edge-bottom-accent",
  edgeBottomAccentForeground: "--ghost-edge-bottom-accent-foreground",
  edgeLeft: "--ghost-edge-left",
  edgeLeftForeground: "--ghost-edge-left-foreground",
  edgeLeftBorder: "--ghost-edge-left-border",
  edgeLeftAccent: "--ghost-edge-left-accent",
  edgeLeftAccentForeground: "--ghost-edge-left-accent-foreground",
  edgeRight: "--ghost-edge-right",
  edgeRightForeground: "--ghost-edge-right-foreground",
  edgeRightBorder: "--ghost-edge-right-border",
  edgeRightAccent: "--ghost-edge-right-accent",
  edgeRightAccentForeground: "--ghost-edge-right-accent-foreground",
  // Surface variants
  surfaceElevated: "--ghost-surface-elevated",
  surfaceHover: "--ghost-surface-hover",
  surfaceInset: "--ghost-surface-inset",
  surfaceInsetDeep: "--ghost-surface-inset-deep",
  surfaceOverlay: "--ghost-surface-overlay",
  // Foreground variants
  foregroundBright: "--ghost-foreground-bright",
  dimForeground: "--ghost-dim-foreground",
  faintForeground: "--ghost-faint-foreground",
  codeForeground: "--ghost-code-foreground",
  // Border variants
  borderMuted: "--ghost-border-muted",
  borderAlt: "--ghost-border-alt",
  borderAccent: "--ghost-border-accent",
  // Primary effects
  primaryGlowSubtle: "--ghost-primary-glow-subtle",
  primaryGlow: "--ghost-primary-glow",
  primaryBorderSemi: "--ghost-primary-border-semi",
  primaryOverlay: "--ghost-primary-overlay",
  // Status foreground/background
  warningForeground: "--ghost-warning-foreground",
  warningBackground: "--ghost-warning-background",
  errorForeground: "--ghost-error-foreground",
  errorBackground: "--ghost-error-background",
  errorForegroundMuted: "--ghost-error-foreground-muted",
  successBackground: "--ghost-success-background",
  successForeground: "--ghost-success-foreground",
  infoBackground: "--ghost-info-background",
  infoForeground: "--ghost-info-foreground",
  // Neutral
  neutralBackground: "--ghost-neutral-background",
  // Window appearance tokens (Hyprland-style)
  opacityActive: "--ghost-opacity-active",
  opacityInactive: "--ghost-opacity-inactive",
  borderActive: "--ghost-border-active",
  borderInactive: "--ghost-border-inactive",
  borderSize: "--ghost-border-size",
} as const;

/** Ordered token groups for UI display (palette preview, settings panels). */
export const THEME_TOKEN_GROUPS: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly tokens: ReadonlyArray<keyof FullThemePalette>;
}> = [
  {
    id: "core",
    label: "Core",
    tokens: ["background", "foreground", "surface", "overlay", "primary", "secondary", "accent", "muted", "cursor", "selectionBackground"],
  },
  {
    id: "surface",
    label: "Surface",
    tokens: ["surfaceElevated", "surfaceHover", "surfaceInset", "surfaceInsetDeep", "surfaceOverlay", "hoverBackground", "activeBackground"],
  },
  {
    id: "foreground",
    label: "Foreground",
    tokens: ["surfaceForeground", "overlayForeground", "primaryForeground", "secondaryForeground", "accentForeground", "mutedForeground", "foregroundBright", "dimForeground", "faintForeground", "codeForeground", "selectionForeground"],
  },
  {
    id: "border",
    label: "Border",
    tokens: ["border", "borderMuted", "borderAlt", "borderAccent", "ring", "input"],
  },
  {
    id: "primary-effects",
    label: "Primary Effects",
    tokens: ["primaryGlowSubtle", "primaryGlow", "primaryBorderSemi", "primaryOverlay"],
  },
  {
    id: "status",
    label: "Status",
    tokens: ["error", "errorForeground", "errorBackground", "errorForegroundMuted", "warning", "warningForeground", "warningBackground", "success", "successForeground", "successBackground", "info", "infoForeground", "infoBackground"],
  },
  {
    id: "chart",
    label: "Chart",
    tokens: ["chart1", "chart2", "chart3", "chart4", "chart5"],
  },
  {
    id: "edge",
    label: "Edge Panels",
    tokens: ["edgeTop", "edgeTopForeground", "edgeTopBorder", "edgeTopAccent", "edgeTopAccentForeground", "edgeBottom", "edgeBottomForeground", "edgeBottomBorder", "edgeBottomAccent", "edgeBottomAccentForeground", "edgeLeft", "edgeLeftForeground", "edgeLeftBorder", "edgeLeftAccent", "edgeLeftAccentForeground", "edgeRight", "edgeRightForeground", "edgeRightBorder", "edgeRightAccent", "edgeRightAccentForeground"],
  },
  {
    id: "window",
    label: "Window",
    tokens: ["borderActive", "borderInactive", "neutralBackground"],
  },
] as const;
