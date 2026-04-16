/**
 * CSS custom property mapping for Ghost theme tokens.
 *
 * Maps every palette token name to its `--ghost-*` CSS variable name.
 * Extracted from theme-derivation.ts to stay within the 350-line file limit.
 */
import type { FullThemePalette } from "./theme-derivation.js";

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
  sidebar: "--ghost-sidebar",
  sidebarForeground: "--ghost-sidebar-foreground",
  sidebarPrimary: "--ghost-sidebar-primary",
  sidebarPrimaryForeground: "--ghost-sidebar-primary-foreground",
  sidebarAccent: "--ghost-sidebar-accent",
  sidebarAccentForeground: "--ghost-sidebar-accent-foreground",
  sidebarBorder: "--ghost-sidebar-border",
  sidebarRing: "--ghost-sidebar-ring",
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
