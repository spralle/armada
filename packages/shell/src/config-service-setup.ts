/**
 * Shell config service setup — creates the ConfigurationService wired with
 * OverrideSession and runs persistence migrations.
 *
 * Extracted from hydratePluginRegistry to keep index.ts focused.
 * Mandatory fallback: if config service creation throws, callers fall back
 * to existing localStorage persistence.
 */

// @weaver/config-types, @weaver/config-providers, @weaver/config-sessions removed.
// Stub types preserve the public API so downstream TypeScript is happy.

import type { ConfigurationService } from "@ghost-shell/contracts";

/** Stub for OverrideSessionController (@weaver/config-sessions removed). */
interface OverrideSessionController {
  [key: string]: unknown;
}

import { createLayoutConfigBridge } from "@ghost-shell/persistence";
import { createContextConfigBridge } from "@ghost-shell/persistence";
import { createKeybindingConfigBridge } from "@ghost-shell/persistence";
import { getCurrentUserId, getStorage } from "./app/utils.js";

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export interface ShellConfigServiceResult {
  configService: ConfigurationService;
  sessionController: OverrideSessionController;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Stub ConfigurationService for degraded operation.
 * Returns undefined for all config reads and silently drops writes.
 * Replace with a real implementation when a config backend is available.
 * @see armada-1g3r for the broader config service roadmap
 */
const noopConfigService: ConfigurationService = {
  get: () => undefined,
  set: () => {},
  onChange: () => () => {},
};

/**
 * Create the shell's ConfigurationService.
 * Returns a no-op stub since @weaver packages were removed.
 * Hydration continues normally; config-dependent features degrade gracefully.
 */
export async function createShellConfigService(): Promise<ShellConfigServiceResult> {
  return { configService: noopConfigService, sessionController: {} };
}

// ---------------------------------------------------------------------------
// Persistence migration runner
// ---------------------------------------------------------------------------

export interface MigrationResults {
  layout: { migrated: boolean; source: string };
  context: { migrated: boolean; source: string };
  keybindings: { migrated: boolean; source: string };
}

/**
 * Run persistence migrations for layout, context, and keybindings.
 * Each migration is idempotent and non-destructive.
 * Failures are caught per-bridge so one failure doesn't block others.
 */
export function runPersistenceMigrations(
  configService: ConfigurationService,
): MigrationResults {
  const storage = getStorage();
  const userId = getCurrentUserId();
  const bridgeOptions = { configService, storage, userId };

  const results: MigrationResults = {
    layout: { migrated: false, source: "none" },
    context: { migrated: false, source: "none" },
    keybindings: { migrated: false, source: "none" },
  };

  try {
    const layoutBridge = createLayoutConfigBridge(bridgeOptions);
    results.layout = layoutBridge.migrate();
  } catch (error) {
    console.warn("[shell:config:migration] layout migration failed", error);
  }

  try {
    const contextBridge = createContextConfigBridge(bridgeOptions);
    results.context = contextBridge.migrate();
  } catch (error) {
    console.warn("[shell:config:migration] context migration failed", error);
  }

  try {
    const keybindingBridge = createKeybindingConfigBridge(bridgeOptions);
    results.keybindings = keybindingBridge.migrate();
  } catch (error) {
    console.warn("[shell:config:migration] keybinding migration failed", error);
  }

  return results;
}
