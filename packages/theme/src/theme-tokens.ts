// theme-tokens.ts — Thin wrapper around the unified Ghost theme system.
// Derives the default dark palette from plugin-contracts and provides
// injection/removal functions for applying theme variables to the DOM.

import type { FullThemePalette, PartialThemePalette } from "@ghost-shell/contracts/theme";
import { GHOST_THEME_CSS_VARS } from "./css-vars.js";
import { deriveFullPalette } from "./derive-palette.js";

// ---------------------------------------------------------------------------
// Default dark palette input (matches Default Dark theme in theme-default-plugin)
// ---------------------------------------------------------------------------

const DEFAULT_DARK_INPUT: PartialThemePalette = {
  mode: "dark",
  background: "#14161a",
  foreground: "#e9edf3",
  surface: "#121922",
  overlay: "#101723",
  primary: "#7cb4ff",
  secondary: "#495f87",
  accent: "#7cb4ff",
  muted: "#2b3040",
  error: "#8b3030",
  warning: "#f2a65a",
  success: "#22c55e",
  info: "#3b82f6",
  border: "#334564",
  ring: "#7cb4ff",
  cursor: "#e9edf3",
  selectionBackground: "#7cb4ff",
  opacity: 0.7,
  opacityActive: 0.85,
};

export const DEFAULT_DARK_PALETTE: FullThemePalette = deriveFullPalette(DEFAULT_DARK_INPUT);

// ---------------------------------------------------------------------------
// Style element management
// ---------------------------------------------------------------------------

const THEME_STYLE_ID = "ghost-theme-variables";

/**
 * Injects (or updates) a `<style>` element that sets all --ghost-*
 * CSS custom properties on the target element (defaults to `:root`).
 */
export function injectThemeVariables(palette: FullThemePalette, target?: HTMLElement): void {
  const rootElement = target ?? document.documentElement;
  const ownerDoc = rootElement.ownerDocument ?? document;

  let styleEl = ownerDoc.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = ownerDoc.createElement("style");
    styleEl.id = THEME_STYLE_ID;
    ownerDoc.head.appendChild(styleEl);
  }

  const entries = Object.entries(GHOST_THEME_CSS_VARS) as [keyof FullThemePalette, string][];
  const declarations = entries
    .filter(([key]) => palette[key] !== undefined)
    .map(([key, cssVar]) => `  ${cssVar}: ${String(palette[key])};`)
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
