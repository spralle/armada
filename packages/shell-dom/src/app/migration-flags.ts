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

export type ShellDndTransportPath = "same-window" | "cross-window-bridge";

export interface ShellCrossWindowDndDecision {
  enabled: boolean;
  path: ShellDndTransportPath;
  reason: "kill-switch-force-disabled" | "flag-enabled" | "default-same-window-only";
}

const DEFAULT_SHELL_MIGRATION_FLAGS: ShellMigrationFlags = {
  useContractCoreApi: true,
  useAdapterComposition: true,
  enableAsyncScompAdapter: false,
  forceLegacyBridge: false,
  enableCrossWindowDnd: true,
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
    __GHOST_SHELL_MIGRATION_FLAGS__?: ShellMigrationFlagOverride;
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
  override: ShellMigrationFlagOverride | null = window.__GHOST_SHELL_MIGRATION_FLAGS__ ?? null,
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

export function selectCrossWindowDnd(flags: ShellMigrationFlags): ShellCrossWindowDndDecision {
  if (flags.forceDisableCrossWindowDnd) {
    return {
      enabled: false,
      path: "same-window",
      reason: "kill-switch-force-disabled",
    };
  }

  if (flags.enableCrossWindowDnd) {
    return {
      enabled: true,
      path: "cross-window-bridge",
      reason: "flag-enabled",
    };
  }

  return {
    enabled: false,
    path: "same-window",
    reason: "default-same-window-only",
  };
}
