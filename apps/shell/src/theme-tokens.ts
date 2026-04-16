// theme-tokens.ts — Ghost theme CSS variable foundation.
// Defines the canonical --ghost-* token names, default dark palette,
// and injection/removal functions for applying theme variables to the DOM.

// ---------------------------------------------------------------------------
// Token name → CSS variable name mapping
// ---------------------------------------------------------------------------

export const GHOST_CSS_VAR_NAMES = {
  background: "--ghost-background",
  backgroundDock: "--ghost-background-dock",
  surface: "--ghost-surface",
  surfaceElevated: "--ghost-surface-elevated",
  surfaceHover: "--ghost-surface-hover",
  surfaceInset: "--ghost-surface-inset",
  surfaceInsetDeep: "--ghost-surface-inset-deep",
  surfaceOverlay: "--ghost-surface-overlay",
  input: "--ghost-input",
  foreground: "--ghost-foreground",
  foregroundBright: "--ghost-foreground-bright",
  mutedForeground: "--ghost-muted-foreground",
  dimForeground: "--ghost-dim-foreground",
  faintForeground: "--ghost-faint-foreground",
  codeForeground: "--ghost-code-foreground",
  border: "--ghost-border",
  borderMuted: "--ghost-border-muted",
  borderAlt: "--ghost-border-alt",
  borderAccent: "--ghost-border-accent",
  primary: "--ghost-primary",
  primaryGlowSubtle: "--ghost-primary-glow-subtle",
  primaryGlow: "--ghost-primary-glow",
  primaryBorderSemi: "--ghost-primary-border-semi",
  primaryOverlay: "--ghost-primary-overlay",
  warning: "--ghost-warning",
  warningForeground: "--ghost-warning-foreground",
  warningBackground: "--ghost-warning-background",
  error: "--ghost-error",
  errorForeground: "--ghost-error-foreground",
  errorBackground: "--ghost-error-background",
  errorForegroundMuted: "--ghost-error-foreground-muted",
  successBackground: "--ghost-success-background",
  successForeground: "--ghost-success-foreground",
  infoBackground: "--ghost-info-background",
  infoForeground: "--ghost-info-foreground",
  neutralBackground: "--ghost-neutral-background",
  opacity: "--ghost-background-opacity",
  panelGap: "--dock-panel-gap",
  panelRadius: "--dock-panel-radius",
} as const;

export type GhostTokenName = keyof typeof GHOST_CSS_VAR_NAMES;
export type GhostPalette = Record<GhostTokenName, string>;

// ---------------------------------------------------------------------------
// Default dark palette — exact current hardcoded values
// ---------------------------------------------------------------------------

export const DEFAULT_DARK_PALETTE: GhostPalette = {
  background: "#14161a",
  backgroundDock: "#11151c",
  surface: "#121922",
  surfaceElevated: "#1d2635",
  surfaceHover: "#1a2230",
  surfaceInset: "#0f1622",
  surfaceInsetDeep: "#0a111c",
  surfaceOverlay: "#101723",
  input: "#0f1319",
  foreground: "#e9edf3",
  foregroundBright: "#f4f8ff",
  mutedForeground: "#c6d0e0",
  dimForeground: "#b6c2d8",
  faintForeground: "#aebbd0",
  codeForeground: "#cfe3ff",
  border: "#334564",
  borderMuted: "#2b3040",
  borderAlt: "#2d415f",
  borderAccent: "#495f87",
  primary: "#7cb4ff",
  primaryGlowSubtle: "#7cb4ff33",
  primaryGlow: "#7cb4ff44",
  primaryBorderSemi: "#7cb4ff88",
  primaryOverlay: "#7cb4ff2e",
  warning: "#f2a65a",
  warningForeground: "#f5d7b5",
  warningBackground: "#30261a",
  error: "#8b3030",
  errorForeground: "#ffc6c6",
  errorBackground: "#3a2020",
  errorForegroundMuted: "#f5b8b8",
  successBackground: "#2a4a2a",
  successForeground: "#8fdf8f",
  infoBackground: "#2a3a5a",
  infoForeground: "#8fb8ff",
  neutralBackground: "#333333",
  opacity: "1",
  panelGap: "6px",
  panelRadius: "6px",
};

// ---------------------------------------------------------------------------
// Style element management
// ---------------------------------------------------------------------------

const THEME_STYLE_ID = "ghost-theme-variables";

/**
 * Injects (or updates) a `<style>` element that sets all --ghost-*
 * CSS custom properties on the target element (defaults to `:root`).
 *
 * Calling this with different palette values swaps the theme at runtime
 * without a page reload.
 */
export function injectThemeVariables(
  palette: Partial<GhostPalette>,
  target?: HTMLElement,
): void {
  const rootElement = target ?? document.documentElement;
  const ownerDoc = rootElement.ownerDocument ?? document;

  let styleEl = ownerDoc.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = ownerDoc.createElement("style");
    styleEl.id = THEME_STYLE_ID;
    ownerDoc.head.appendChild(styleEl);
  }

  const declarations = (Object.keys(GHOST_CSS_VAR_NAMES) as GhostTokenName[])
    .filter((token) => palette[token] !== undefined)
    .map((token) => `  ${GHOST_CSS_VAR_NAMES[token]}: ${palette[token]};`)
    .join("\n");

  const selector = rootElement === ownerDoc.documentElement ? ":root" : `#${rootElement.id}`;
  styleEl.textContent = `${selector} {\n${declarations}\n}`;
}

/**
 * Removes the injected theme style element from the target's document.
 */
export function removeThemeVariables(target?: HTMLElement): void {
  const rootElement = target ?? document.documentElement;
  const ownerDoc = rootElement.ownerDocument ?? document;
  const styleEl = ownerDoc.getElementById(THEME_STYLE_ID);
  if (styleEl) {
    styleEl.remove();
  }
}
