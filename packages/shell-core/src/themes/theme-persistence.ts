// theme-persistence.ts — User theme preference persistence via localStorage.
//
// Covers two concerns:
//   1. Active theme ID preference.
//   2. Per-theme background selection preference.

const THEME_STORAGE_KEY = "ghost-shell-theme-preference";
const BACKGROUND_STORAGE_KEY = "ghost-shell-background-preference";

// ---------------------------------------------------------------------------
// Theme preference
// ---------------------------------------------------------------------------

/**
 * Persisted theme preference containing both the theme ID and the plugin
 * that provides it. The `pluginId` enables demand-driven plugin activation
 * at startup — only the plugin for the active theme is loaded.
 */
export interface ThemePreferenceData {
  themeId: string;
  pluginId: string;
}

/**
 * Read the user's persisted theme preference from localStorage.
 *
 * Handles two storage formats for backward compatibility:
 * - New format: JSON `{"themeId":"...","pluginId":"..."}`
 * - Old format: plain string (theme ID only) → returns `pluginId: ""`
 *
 * Returns null if no preference is stored or localStorage is unavailable.
 */
export function readUserThemePreference(): ThemePreferenceData | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return parseThemePreference(raw);
  } catch {
    return null;
  }
}

/** Parse a raw localStorage value into ThemePreferenceData. */
function parseThemePreference(raw: string): ThemePreferenceData {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      "themeId" in parsed &&
      typeof (parsed as Record<string, unknown>).themeId === "string"
    ) {
      const obj = parsed as Record<string, unknown>;
      return {
        themeId: obj.themeId as string,
        pluginId: typeof obj.pluginId === "string" ? obj.pluginId : "",
      };
    }
  } catch {
    // Not valid JSON — fall through to old-format handling.
  }
  // Old format: plain string theme ID.
  return { themeId: raw, pluginId: "" };
}

/**
 * Persist the user's selected theme preference to localStorage.
 * Stores both the theme ID and the providing plugin ID for demand-driven
 * activation at startup.
 *
 * Silently fails if localStorage is unavailable.
 */
export function writeUserThemePreference(data: ThemePreferenceData): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silently ignore — localStorage may be full or unavailable.
  }
}

/**
 * Remove the user's persisted theme preference from localStorage.
 * Silently fails if localStorage is unavailable.
 */
export function clearUserThemePreference(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Silently ignore.
  }
}

// ---------------------------------------------------------------------------
// Background preference (per-theme)
// ---------------------------------------------------------------------------

export interface BackgroundPreference {
  /** Index into the theme's backgrounds array, or null if using custom. */
  index: number | null;
  /** Custom background entry (used when index is null). */
  custom?: { url: string; mode?: "cover" | "contain" | "tile" } | undefined;
}

/** Internal: read the entire background preferences map from localStorage. */
function readAllBackgroundPreferences(): Record<string, BackgroundPreference> {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return {};
    }
    const raw = window.localStorage.getItem(BACKGROUND_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, BackgroundPreference>;
  } catch {
    return {};
  }
}

/** Internal: write the entire background preferences map to localStorage. */
function writeAllBackgroundPreferences(
  prefs: Record<string, BackgroundPreference>,
): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(BACKGROUND_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Silently ignore — localStorage may be full or unavailable.
  }
}

/**
 * Read per-theme background preference. Returns null if no preference stored.
 */
export function readBackgroundPreference(
  themeId: string,
): BackgroundPreference | null {
  const all = readAllBackgroundPreferences();
  return all[themeId] ?? null;
}

/**
 * Write per-theme background preference.
 */
export function writeBackgroundPreference(
  themeId: string,
  pref: BackgroundPreference,
): void {
  const all = readAllBackgroundPreferences();
  all[themeId] = pref;
  writeAllBackgroundPreferences(all);
}

/**
 * Clear per-theme background preference without affecting other themes.
 */
export function clearBackgroundPreference(themeId: string): void {
  const all = readAllBackgroundPreferences();
  delete all[themeId];
  writeAllBackgroundPreferences(all);
}
