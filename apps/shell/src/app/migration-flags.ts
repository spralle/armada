export interface ShellMigrationFlags {
  useContractCoreApi: boolean;
  useAdapterComposition: boolean;
  enableAsyncScompAdapter: boolean;
  forceLegacyBridge: boolean;
  enableCrossWindowDnd: boolean;
  forceDisableCrossWindowDnd: boolean;
}

export interface ShellMigrationFlagOverride {
  useContractCoreApi?: boolean;
  useAdapterComposition?: boolean;
  enableAsyncScompAdapter?: boolean;
  forceLegacyBridge?: boolean;
  enableCrossWindowDnd?: boolean;
  forceDisableCrossWindowDnd?: boolean;
}

export type ShellTransportPath = "legacy-bridge" | "async-scomp-adapter";

export interface ShellTransportDecision {
  path: ShellTransportPath;
  reason: "kill-switch-force-legacy" | "async-flag-enabled" | "default-legacy";
}

const DEFAULT_SHELL_MIGRATION_FLAGS: ShellMigrationFlags = {
  useContractCoreApi: true,
  useAdapterComposition: true,
  enableAsyncScompAdapter: false,
  forceLegacyBridge: false,
  enableCrossWindowDnd: false,
  forceDisableCrossWindowDnd: false,
};

const ENABLED_FLAG_VALUES = new Set([
  "1",
  "true",
  "yes",
  "on",
  "enabled",
]);

declare global {
  interface Window {
    __ARMADA_SHELL_MIGRATION_FLAGS__?: ShellMigrationFlagOverride;
  }
}

function parseBooleanFlag(raw: string | null): boolean | undefined {
  if (raw === null) {
    return undefined;
  }

  return ENABLED_FLAG_VALUES.has(raw.trim().toLowerCase());
}

export function readShellMigrationFlags(
  searchParams: URLSearchParams = new URLSearchParams(window.location.search),
  override: ShellMigrationFlagOverride | null = window.__ARMADA_SHELL_MIGRATION_FLAGS__ ?? null,
): ShellMigrationFlags {
  const coreFromQuery = parseBooleanFlag(searchParams.get("shellCoreContract"));
  const adapterFromQuery = parseBooleanFlag(searchParams.get("shellAdapterComposition"));
  const asyncTransportFromQuery = parseBooleanFlag(searchParams.get("shellAsyncScompAdapter"));
  const forceLegacyFromQuery = parseBooleanFlag(searchParams.get("shellLegacyBridgeKillSwitch"));
  const enableCrossWindowDndFromQuery = parseBooleanFlag(searchParams.get("shellCrossWindowDnd"));
  const forceDisableCrossWindowDndFromQuery = parseBooleanFlag(searchParams.get("shellCrossWindowDndKillSwitch"));

  return {
    useContractCoreApi: override?.useContractCoreApi ?? coreFromQuery ?? DEFAULT_SHELL_MIGRATION_FLAGS.useContractCoreApi,
    useAdapterComposition: override?.useAdapterComposition ?? adapterFromQuery ?? DEFAULT_SHELL_MIGRATION_FLAGS.useAdapterComposition,
    enableAsyncScompAdapter: override?.enableAsyncScompAdapter ?? asyncTransportFromQuery ?? DEFAULT_SHELL_MIGRATION_FLAGS.enableAsyncScompAdapter,
    forceLegacyBridge: override?.forceLegacyBridge ?? forceLegacyFromQuery ?? DEFAULT_SHELL_MIGRATION_FLAGS.forceLegacyBridge,
    enableCrossWindowDnd:
      override?.enableCrossWindowDnd
      ?? enableCrossWindowDndFromQuery
      ?? DEFAULT_SHELL_MIGRATION_FLAGS.enableCrossWindowDnd,
    forceDisableCrossWindowDnd:
      override?.forceDisableCrossWindowDnd
      ?? forceDisableCrossWindowDndFromQuery
      ?? DEFAULT_SHELL_MIGRATION_FLAGS.forceDisableCrossWindowDnd,
  };
}

export function shouldUseContractComposition(flags: ShellMigrationFlags): boolean {
  return flags.useContractCoreApi && flags.useAdapterComposition;
}

export function selectShellTransportPath(flags: ShellMigrationFlags): ShellTransportDecision {
  if (flags.forceLegacyBridge) {
    return {
      path: "legacy-bridge",
      reason: "kill-switch-force-legacy",
    };
  }

  if (flags.enableAsyncScompAdapter) {
    return {
      path: "async-scomp-adapter",
      reason: "async-flag-enabled",
    };
  }

  return {
    path: "legacy-bridge",
    reason: "default-legacy",
  };
}
