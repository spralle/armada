export interface ShellMigrationFlags {
  useContractCoreApi: boolean;
  useAdapterComposition: boolean;
}

export interface ShellMigrationFlagOverride {
  useContractCoreApi?: boolean;
  useAdapterComposition?: boolean;
}

const DEFAULT_SHELL_MIGRATION_FLAGS: ShellMigrationFlags = {
  useContractCoreApi: false,
  useAdapterComposition: false,
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

  return {
    useContractCoreApi: override?.useContractCoreApi ?? coreFromQuery ?? DEFAULT_SHELL_MIGRATION_FLAGS.useContractCoreApi,
    useAdapterComposition: override?.useAdapterComposition ?? adapterFromQuery ?? DEFAULT_SHELL_MIGRATION_FLAGS.useAdapterComposition,
  };
}

export function shouldUseContractComposition(flags: ShellMigrationFlags): boolean {
  return flags.useContractCoreApi && flags.useAdapterComposition;
}
