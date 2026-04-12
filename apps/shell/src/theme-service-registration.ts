// theme-service-registration.ts — ThemeService adapter and shell registration.
//
// Bridges the internal ThemeRegistry (shell-private) to the public
// ThemeService contract (plugin-facing). Registers the service as a
// builtin plugin capability through the PluginRegistry.

import type {
  ThemeService,
  ThemeInfo,
  BackgroundInfo,
  ThemeBackgroundEntry,
  PluginContract,
} from "@ghost/plugin-contracts";
import { THEME_SERVICE_ID } from "@ghost/plugin-contracts";
import type { ThemeRegistry } from "./theme-registry.js";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export const THEME_SERVICE_PLUGIN_ID = "ghost.shell.theme-service";

// ---------------------------------------------------------------------------
// Adapter factory + registration
// ---------------------------------------------------------------------------

/**
 * Create a ThemeService adapter from a ThemeRegistry and register it
 * as a builtin plugin capability on the plugin registry.
 */
export function registerThemeServiceCapability(
  registry: ShellPluginRegistry,
  themeRegistry: ThemeRegistry,
): void {
  const themeService: ThemeService = {
    listThemes(): ThemeInfo[] {
      return themeRegistry.getAvailableThemes();
    },

    getActiveThemeId(): string | null {
      return themeRegistry.getActiveThemeId();
    },

    setTheme(themeId: string): boolean {
      return themeRegistry.setTheme(themeId);
    },

    listBackgrounds(): ThemeBackgroundEntry[] {
      return themeRegistry.getAvailableBackgrounds();
    },

    getActiveBackground(): BackgroundInfo | null {
      return themeRegistry.getActiveBackground();
    },

    setBackground(index: number): boolean {
      return themeRegistry.setBackground(index);
    },

    setCustomBackground(url: string, mode?: "cover" | "contain" | "tile"): void {
      themeRegistry.setCustomBackground(url, mode);
    },

    clearCustomBackground(): void {
      themeRegistry.clearCustomBackground();
    },

    loadAllThemes(): Promise<void> {
      return themeRegistry.loadAllThemes();
    },
  };

  const contract: PluginContract = {
    manifest: {
      id: THEME_SERVICE_PLUGIN_ID,
      name: "Theme Service Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [
          { id: THEME_SERVICE_ID, version: "1.0.0" },
        ],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [THEME_SERVICE_ID]: themeService });
}
