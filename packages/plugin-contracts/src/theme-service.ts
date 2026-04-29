// theme-service.ts — Public ThemeService contract for plugin consumption.
//
// Plugins access theme management via:
//   services.getService<ThemeService>('ghost.theme.Service')
//
// This is a stable public API. Internal ThemeRegistry details are hidden
// behind an adapter in the shell.

import type { ThemeBackgroundEntry } from "./types.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Theme info visible to consumers. */
export interface ThemeInfo {
  id: string;
  name: string;
  author?: string | undefined;
  mode: string;
}

/** Info about the currently active background. */
export interface BackgroundInfo {
  url: string;
  mode: "cover" | "contain" | "tile";
  source: "theme" | "custom";
  index: number | null;
}

// ---------------------------------------------------------------------------
// ThemeService interface
// ---------------------------------------------------------------------------

export interface ThemeService {
  /** List all available themes. */
  listThemes(): ThemeInfo[];

  /** Get the ID of the currently active theme (null if none). */
  getActiveThemeId(): string | null;

  /** Switch to a theme by ID. Returns false if not found. */
  setTheme(themeId: string): boolean;

  /** Get backgrounds available for the active theme. */
  listBackgrounds(): ThemeBackgroundEntry[];

  /** Get the currently active background (null if none). */
  getActiveBackground(): BackgroundInfo | null;

  /** Set background by index from the active theme's list. Returns false if invalid. */
  setBackground(index: number): boolean;

  /** Set a custom background URL. */
  setCustomBackground(url: string, mode?: "cover" | "contain" | "tile"): void;

  /** Clear custom background, revert to theme default. */
  clearCustomBackground(): void;

  /** Load all available theme plugins and discover their themes. For gallery population. */
  loadAllThemes(): Promise<void>;

  /** Get all CSS variable values for a given theme, or null if not found. */
  getThemePalette(themeId: string): Record<string, string> | null;
}

// ---------------------------------------------------------------------------
// Well-known service ID
// ---------------------------------------------------------------------------

/** Well-known service ID for the ThemeService. */
export const THEME_SERVICE_ID = "ghost.theme.Service" as const;
