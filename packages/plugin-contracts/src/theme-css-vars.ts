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
  // Window appearance tokens (Hyprland-style)
  opacityActive: "--ghost-opacity-active",
  opacityInactive: "--ghost-opacity-inactive",
  borderActive: "--ghost-border-active",
  borderInactive: "--ghost-border-inactive",
  borderSize: "--ghost-border-size",
} as const;
