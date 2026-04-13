/**
 * Migration-flags subsumption: declares migration flags as config service
 * properties and provides a backward-compatible adapter that reads from
 * ConfigurationService instead of localStorage/URL params.
 *
 * The existing readShellMigrationFlags() remains fully functional as fallback.
 */

import type { ConfigurationPropertySchema } from "@ghost/config-types";
import type { ConfigurationService } from "@ghost/config-types";
import type { ShellMigrationFlags } from "./migration-flags.js";

// ---------------------------------------------------------------------------
// Config key constants — single source of truth for ghost.shell.migration.*
// ---------------------------------------------------------------------------

export const MIGRATION_FLAG_KEYS = {
  useContractCoreApi: "ghost.shell.migration.useContractCoreApi",
  useAdapterComposition: "ghost.shell.migration.useAdapterComposition",
  enableAsyncScompAdapter: "ghost.shell.migration.enableAsyncScompAdapter",
  forceLegacyBridge: "ghost.shell.migration.forceLegacyBridge",
  enableCrossWindowDnd: "ghost.shell.migration.enableCrossWindowDnd",
  forceDisableCrossWindowDnd: "ghost.shell.migration.forceDisableCrossWindowDnd",
} as const satisfies Record<keyof ShellMigrationFlags, string>;

// ---------------------------------------------------------------------------
// Default values — must match DEFAULT_SHELL_MIGRATION_FLAGS in migration-flags.ts
// ---------------------------------------------------------------------------

const DEFAULTS: Readonly<ShellMigrationFlags> = {
  useContractCoreApi: true,
  useAdapterComposition: true,
  enableAsyncScompAdapter: false,
  forceLegacyBridge: false,
  enableCrossWindowDnd: true,
  forceDisableCrossWindowDnd: false,
};

// ---------------------------------------------------------------------------
// Property schema declarations
// ---------------------------------------------------------------------------

export const migrationFlagSchemas: ReadonlyArray<
  ConfigurationPropertySchema & { key: string }
> = [
  {
    key: MIGRATION_FLAG_KEYS.useContractCoreApi,
    type: "boolean",
    default: DEFAULTS.useContractCoreApi,
    title: "Use Contract Core API",
    description:
      "Enable the contract-based core API path for shell rendering.",
  },
  {
    key: MIGRATION_FLAG_KEYS.useAdapterComposition,
    type: "boolean",
    default: DEFAULTS.useAdapterComposition,
    title: "Use Adapter Composition",
    description:
      "Enable adapter composition mode for shell bootstrap.",
  },
  {
    key: MIGRATION_FLAG_KEYS.enableAsyncScompAdapter,
    type: "boolean",
    default: DEFAULTS.enableAsyncScompAdapter,
    title: "Enable Async Scomp Adapter",
    description:
      "Enable the async scomp adapter transport path instead of legacy bridge.",
  },
  {
    key: MIGRATION_FLAG_KEYS.forceLegacyBridge,
    type: "boolean",
    default: DEFAULTS.forceLegacyBridge,
    title: "Force Legacy Bridge (Kill Switch)",
    description:
      "Kill switch: force legacy bridge transport regardless of other flags.",
  },
  {
    key: MIGRATION_FLAG_KEYS.enableCrossWindowDnd,
    type: "boolean",
    default: DEFAULTS.enableCrossWindowDnd,
    title: "Enable Cross-Window Drag and Drop",
    description:
      "Enable cross-window drag-and-drop bridge for multi-window scenarios.",
  },
  {
    key: MIGRATION_FLAG_KEYS.forceDisableCrossWindowDnd,
    type: "boolean",
    default: DEFAULTS.forceDisableCrossWindowDnd,
    title: "Force Disable Cross-Window DnD (Kill Switch)",
    description:
      "Kill switch: force-disable cross-window drag-and-drop regardless of enable flag.",
  },
];

// ---------------------------------------------------------------------------
// Adapter — reads migration flags from ConfigurationService
// ---------------------------------------------------------------------------

export function readMigrationFlagsFromConfig(
  configService: ConfigurationService,
): ShellMigrationFlags {
  return {
    useContractCoreApi:
      configService.get<boolean>(MIGRATION_FLAG_KEYS.useContractCoreApi)
      ?? DEFAULTS.useContractCoreApi,
    useAdapterComposition:
      configService.get<boolean>(MIGRATION_FLAG_KEYS.useAdapterComposition)
      ?? DEFAULTS.useAdapterComposition,
    enableAsyncScompAdapter:
      configService.get<boolean>(MIGRATION_FLAG_KEYS.enableAsyncScompAdapter)
      ?? DEFAULTS.enableAsyncScompAdapter,
    forceLegacyBridge:
      configService.get<boolean>(MIGRATION_FLAG_KEYS.forceLegacyBridge)
      ?? DEFAULTS.forceLegacyBridge,
    enableCrossWindowDnd:
      configService.get<boolean>(MIGRATION_FLAG_KEYS.enableCrossWindowDnd)
      ?? DEFAULTS.enableCrossWindowDnd,
    forceDisableCrossWindowDnd:
      configService.get<boolean>(MIGRATION_FLAG_KEYS.forceDisableCrossWindowDnd)
      ?? DEFAULTS.forceDisableCrossWindowDnd,
  };
}
