// theme-registry.ts — Shell theme registry: discovery, switching, and application.
//
// Discovers theme contributions from active plugins, applies CSS variables
// via the derivation engine, and supports runtime theme switching with
// user preference persistence.

import type {
  FullThemePalette,
  PluginContract,
  ThemeContribution,
} from "@ghost/plugin-contracts";
import {
  composeThemeContributions,
  deriveFullPalette,
  GHOST_THEME_CSS_VARS,
} from "@ghost/plugin-contracts";
import type { ComposedThemeContribution } from "@ghost/plugin-contracts";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";
import {
  readUserThemePreference,
  writeUserThemePreference,
} from "./theme-persistence.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ThemeRegistryOptions {
  pluginRegistry: ShellPluginRegistry;
  tenantDefaultThemeId?: string | undefined;
}

export interface AvailableTheme {
  id: string;
  name: string;
  mode: string;
  pluginId: string;
}

export interface ThemeRegistry {
  /** Discover themes from all active plugins. */
  discoverThemes(): void;
  /** Get list of available theme IDs, names, modes, and source plugins. */
  getAvailableThemes(): AvailableTheme[];
  /** Get the currently active theme ID (null if none applied). */
  getActiveThemeId(): string | null;
  /** Switch to a different theme by ID. Applies CSS variables immediately. Returns false if theme not found. */
  setTheme(themeId: string): boolean;
  /** Apply the resolved initial theme (user pref → tenant default → first available). */
  applyInitialTheme(): void;
}

// ---------------------------------------------------------------------------
// CSS variable injection
// ---------------------------------------------------------------------------

const THEME_DERIVED_STYLE_ID = "ghost-theme-derived-variables";

/**
 * Inject derived palette CSS variables onto :root via a managed style element.
 * Uses the canonical GHOST_THEME_CSS_VARS mapping from plugin-contracts.
 */
function injectDerivedPaletteVariables(palette: FullThemePalette): void {
  if (typeof document === "undefined") {
    return;
  }

  let styleEl = document.getElementById(THEME_DERIVED_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = THEME_DERIVED_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const entries = Object.entries(GHOST_THEME_CSS_VARS) as Array<
    [keyof FullThemePalette, string]
  >;
  const declarations = entries
    .map(([token, cssVar]) => `  ${cssVar}: ${palette[token]};`)
    .join("\n");

  styleEl.textContent = `:root {\n${declarations}\n}`;
}

// ---------------------------------------------------------------------------
// Plugin source collection
// ---------------------------------------------------------------------------

function collectPluginThemeSources(
  registry: ShellPluginRegistry,
): Array<{ pluginId: string; contract: PluginContract }> {
  const snapshot = registry.getSnapshot();
  const sources: Array<{ pluginId: string; contract: PluginContract }> = [];

  for (const plugin of snapshot.plugins) {
    if (!plugin.enabled || !plugin.contract) {
      continue;
    }
    sources.push({ pluginId: plugin.id, contract: plugin.contract });
  }

  return sources;
}

// ---------------------------------------------------------------------------
// Theme resolution
// ---------------------------------------------------------------------------

function resolveThemeId(
  themes: ComposedThemeContribution[],
  tenantDefaultThemeId: string | undefined,
): string | null {
  if (themes.length === 0) {
    return null;
  }

  // 1. User preference from localStorage
  const userPref = readUserThemePreference();
  if (userPref && themes.some((t) => t.id === userPref)) {
    return userPref;
  }

  // 2. Tenant default
  if (tenantDefaultThemeId && themes.some((t) => t.id === tenantDefaultThemeId)) {
    return tenantDefaultThemeId;
  }

  // 3. First available theme
  return themes[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createThemeRegistry(options: ThemeRegistryOptions): ThemeRegistry {
  const { pluginRegistry, tenantDefaultThemeId } = options;
  let discoveredThemes: ComposedThemeContribution[] = [];
  let activeThemeId: string | null = null;

  function findTheme(themeId: string): ComposedThemeContribution | undefined {
    return discoveredThemes.find((t) => t.id === themeId);
  }

  function applyTheme(theme: ThemeContribution): void {
    const fullPalette = deriveFullPalette(theme.palette, theme.terminal);
    injectDerivedPaletteVariables(fullPalette);
  }

  return {
    discoverThemes() {
      const sources = collectPluginThemeSources(pluginRegistry);
      discoveredThemes = composeThemeContributions(sources);
    },

    getAvailableThemes(): AvailableTheme[] {
      return discoveredThemes.map((theme) => ({
        id: theme.id,
        name: theme.name,
        mode: theme.mode,
        pluginId: theme.pluginId,
      }));
    },

    getActiveThemeId(): string | null {
      return activeThemeId;
    },

    setTheme(themeId: string): boolean {
      const theme = findTheme(themeId);
      if (!theme) {
        return false;
      }

      applyTheme(theme);
      activeThemeId = themeId;
      writeUserThemePreference(themeId);
      return true;
    },

    applyInitialTheme() {
      const resolvedId = resolveThemeId(discoveredThemes, tenantDefaultThemeId);
      if (!resolvedId) {
        return;
      }

      const theme = findTheme(resolvedId);
      if (!theme) {
        return;
      }

      applyTheme(theme);
      activeThemeId = resolvedId;
    },
  };
}
