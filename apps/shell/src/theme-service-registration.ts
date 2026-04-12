// theme-service-registration.ts — ThemeService adapter and shell registration.
//
// Bridges the internal ThemeRegistry (shell-private) to the public
// ThemeService contract (plugin-facing). Registers the service with
// the shell's service registry during bootstrap.

import type {
  ThemeService,
  ThemeInfo,
  BackgroundInfo,
  ThemeBackgroundEntry,
} from "@ghost/plugin-contracts";
import { THEME_SERVICE_ID } from "@ghost/plugin-contracts";
import type { ThemeRegistry } from "./theme-registry.js";
import type { ShellServiceRegistry } from "./service-registry.js";

// ---------------------------------------------------------------------------
// Declaration merge — type-safe service lookup
// ---------------------------------------------------------------------------

declare module "./service-registry.js" {
  interface ShellServiceIdMap {
    "ghost.theme.Service": ThemeService;
  }
}

// ---------------------------------------------------------------------------
// Adapter factory + registration
// ---------------------------------------------------------------------------

/**
 * Create a ThemeService adapter from a ThemeRegistry and register it
 * with the shell service registry.
 */
export function registerThemeService(
  services: ShellServiceRegistry,
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
  };

  services.registerService(THEME_SERVICE_ID, themeService);
}
