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

/** Stub for ConfigurationService (@weaver/config-types removed). */
interface ConfigurationService {
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown, layer?: string): void;
  onChange(key: string, listener: (value: unknown) => void): () => void;
  [key: string]: unknown;
}

/** Stub for OverrideSessionController (@weaver/config-sessions removed). */
interface OverrideSessionController {
  [key: string]: unknown;
}

import { createLayoutConfigBridge } from "./persistence/layout-config-bridge.js";
import { createContextConfigBridge } from "./persistence/context-config-bridge.js";
import { createKeybindingConfigBridge } from "./persistence/keybinding-config-bridge.js";
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

/** No-op ConfigurationService stub (@weaver packages removed). */
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
