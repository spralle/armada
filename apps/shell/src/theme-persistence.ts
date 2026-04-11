// theme-persistence.ts — User theme preference persistence via localStorage.

const THEME_STORAGE_KEY = "ghost-shell-theme-preference";

/**
 * Read the user's persisted theme preference from localStorage.
 * Returns null if no preference is stored or localStorage is unavailable.
 */
export function readUserThemePreference(): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist the user's selected theme ID to localStorage.
 * Silently fails if localStorage is unavailable.
 */
export function writeUserThemePreference(themeId: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
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
