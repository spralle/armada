export { deriveFullPalette } from "./derive-palette.js";
export * from "./color-utils.js";
export { GHOST_THEME_CSS_VARS, THEME_TOKEN_GROUPS } from "./css-vars.js";

// Theme token injection
export { DEFAULT_DARK_PALETTE, injectThemeVariables, removeThemeVariables } from "./theme-tokens.js";

// Theme persistence
export type { ThemePreferenceData, BackgroundPreference } from "./theme-persistence.js";
export {
  readUserThemePreference,
  writeUserThemePreference,
  clearUserThemePreference,
  readBackgroundPreference,
  writeBackgroundPreference,
  clearBackgroundPreference,
} from "./theme-persistence.js";

// Background image cache
export { resolveBackgroundUrl, preloadBackgroundUrls } from "./theme-background-cache.js";

// Background image DOM management
export { manageBackgroundImage } from "./theme-background.js";
