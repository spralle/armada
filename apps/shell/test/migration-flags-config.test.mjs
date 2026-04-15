import test from "node:test";
import assert from "node:assert/strict";
import {
  migrationFlagSchemas,
  readMigrationFlagsFromConfig,
  MIGRATION_FLAG_KEYS,
} from "../dist-test/src/app/migration-flags-config.js";
import {
  readShellMigrationFlags,
  selectShellTransportPath,
  selectCrossWindowDnd,
} from "../dist-test/src/app/migration-flags.js";

// ---------------------------------------------------------------------------
// Stub ConfigurationService — minimal mock that satisfies the adapter
// ---------------------------------------------------------------------------

function createStubConfigService(entries = {}) {
  return {
    get(key) {
      return Object.hasOwn(entries, key) ? entries[key] : undefined;
    },
    getWithDefault(key, defaultValue) {
      const v = entries[key];
      return v !== undefined ? v : defaultValue;
    },
    getAtLayer() { return undefined; },
    getForScope() { return undefined; },
    inspect(key) {
      return { key, effectiveValue: entries[key], effectiveLayer: undefined };
    },
    set() { throw new Error("stub: set not supported"); },
    remove() { throw new Error("stub: remove not supported"); },
    onChange() { return () => {}; },
    getNamespace() { return {}; },
  };
}

// ---------------------------------------------------------------------------
// 1. Schemas declare all flags from readShellMigrationFlags
// ---------------------------------------------------------------------------

test("migrationFlagSchemas declares a schema for every ShellMigrationFlags key", () => {
  const defaultFlags = readShellMigrationFlags(new URLSearchParams(), null);
  const schemaKeys = new Set(migrationFlagSchemas.map((s) => s.key));
  const expectedKeys = new Set(Object.values(MIGRATION_FLAG_KEYS));

  // Every flag in ShellMigrationFlags must have a schema
  for (const flagName of Object.keys(defaultFlags)) {
    const configKey = MIGRATION_FLAG_KEYS[flagName];
    assert.ok(configKey, `MIGRATION_FLAG_KEYS should have entry for "${flagName}"`);
    assert.ok(
      schemaKeys.has(configKey),
      `migrationFlagSchemas should declare schema for "${configKey}"`,
    );
  }

  // Every schema key should map to a flag
  assert.equal(schemaKeys.size, Object.keys(defaultFlags).length,
    "Schema count should match flag count");
  assert.deepEqual(schemaKeys, expectedKeys);
});

test("all migration flag schemas have type boolean", () => {
  for (const schema of migrationFlagSchemas) {
    assert.equal(schema.type, "boolean", `Schema "${schema.key}" should be boolean`);
  }
});

test("all migration flag schemas have a description", () => {
  for (const schema of migrationFlagSchemas) {
    assert.ok(
      schema.description && schema.description.length > 0,
      `Schema "${schema.key}" should have a non-empty description`,
    );
  }
});

// ---------------------------------------------------------------------------
// 2. readMigrationFlagsFromConfig returns correct defaults when config empty
// ---------------------------------------------------------------------------

test("readMigrationFlagsFromConfig returns correct defaults when config is empty", () => {
  const configService = createStubConfigService({});
  const flags = readMigrationFlagsFromConfig(configService);

  assert.equal(flags.useContractCoreApi, true, "useContractCoreApi default");
  assert.equal(flags.useAdapterComposition, true, "useAdapterComposition default");
  assert.equal(flags.enableAsyncScompAdapter, false, "enableAsyncScompAdapter default");
  assert.equal(flags.forceLegacyBridge, false, "forceLegacyBridge default");
  assert.equal(flags.enableCrossWindowDnd, true, "enableCrossWindowDnd default");
  assert.equal(flags.forceDisableCrossWindowDnd, false, "forceDisableCrossWindowDnd default");
});

// ---------------------------------------------------------------------------
// 3. readMigrationFlagsFromConfig reads values from config service
// ---------------------------------------------------------------------------

test("readMigrationFlagsFromConfig reads overridden values from config service", () => {
  const configService = createStubConfigService({
    "ghost.shell.migration.useContractCoreApi": false,
    "ghost.shell.migration.enableAsyncScompAdapter": true,
    "ghost.shell.migration.forceLegacyBridge": true,
    "ghost.shell.migration.enableCrossWindowDnd": false,
  });
  const flags = readMigrationFlagsFromConfig(configService);

  assert.equal(flags.useContractCoreApi, false, "should read useContractCoreApi=false");
  assert.equal(flags.useAdapterComposition, true, "should fallback to default for unset key");
  assert.equal(flags.enableAsyncScompAdapter, true, "should read enableAsyncScompAdapter=true");
  assert.equal(flags.forceLegacyBridge, true, "should read forceLegacyBridge=true");
  assert.equal(flags.enableCrossWindowDnd, false, "should read enableCrossWindowDnd=false");
  assert.equal(flags.forceDisableCrossWindowDnd, false, "should fallback for unset kill switch");
});

// ---------------------------------------------------------------------------
// 4. readMigrationFlagsFromConfig produces same output shape as readShellMigrationFlags
// ---------------------------------------------------------------------------

test("readMigrationFlagsFromConfig produces same shape as readShellMigrationFlags", () => {
  const legacyFlags = readShellMigrationFlags(new URLSearchParams(), null);
  const configFlags = readMigrationFlagsFromConfig(createStubConfigService({}));

  // Same keys
  const legacyKeys = Object.keys(legacyFlags).sort();
  const configKeys = Object.keys(configFlags).sort();
  assert.deepEqual(configKeys, legacyKeys, "flag keys should be identical");

  // Same default values
  assert.deepEqual(configFlags, legacyFlags, "default values should match exactly");
});

test("config-provided flags match legacy flags for non-default scenario", () => {
  const legacyFlags = readShellMigrationFlags(
    new URLSearchParams("shellAsyncScompAdapter=true&shellLegacyBridgeKillSwitch=1"),
    null,
  );
  const configFlags = readMigrationFlagsFromConfig(createStubConfigService({
    "ghost.shell.migration.enableAsyncScompAdapter": true,
    "ghost.shell.migration.forceLegacyBridge": true,
  }));

  assert.equal(configFlags.enableAsyncScompAdapter, legacyFlags.enableAsyncScompAdapter);
  assert.equal(configFlags.forceLegacyBridge, legacyFlags.forceLegacyBridge);
  // Other defaults should match
  assert.equal(configFlags.useContractCoreApi, legacyFlags.useContractCoreApi);
  assert.equal(configFlags.useAdapterComposition, legacyFlags.useAdapterComposition);
});

// ---------------------------------------------------------------------------
// 5. selectShellTransportPath works with config-provided flags
// ---------------------------------------------------------------------------

test("selectShellTransportPath: default config flags produce legacy-bridge", () => {
  const flags = readMigrationFlagsFromConfig(createStubConfigService({}));
  const decision = selectShellTransportPath(flags);

  assert.equal(decision.path, "legacy-bridge");
  assert.equal(decision.reason, "default-legacy");
});

test("selectShellTransportPath: async adapter enabled via config", () => {
  const flags = readMigrationFlagsFromConfig(createStubConfigService({
    "ghost.shell.migration.enableAsyncScompAdapter": true,
  }));
  const decision = selectShellTransportPath(flags);

  assert.equal(decision.path, "async-scomp-adapter");
  assert.equal(decision.reason, "async-flag-enabled");
});

test("selectShellTransportPath: kill switch via config forces legacy", () => {
  const flags = readMigrationFlagsFromConfig(createStubConfigService({
    "ghost.shell.migration.enableAsyncScompAdapter": true,
    "ghost.shell.migration.forceLegacyBridge": true,
  }));
  const decision = selectShellTransportPath(flags);

  assert.equal(decision.path, "legacy-bridge");
  assert.equal(decision.reason, "kill-switch-force-legacy");
});

test("selectCrossWindowDnd: default config flags produce cross-window-bridge", () => {
  const flags = readMigrationFlagsFromConfig(createStubConfigService({}));
  const decision = selectCrossWindowDnd(flags);

  assert.equal(decision.enabled, true);
  assert.equal(decision.path, "cross-window-bridge");
  assert.equal(decision.reason, "flag-enabled");
});

test("selectCrossWindowDnd: kill switch via config forces same-window", () => {
  const flags = readMigrationFlagsFromConfig(createStubConfigService({
    "ghost.shell.migration.forceDisableCrossWindowDnd": true,
  }));
  const decision = selectCrossWindowDnd(flags);

  assert.equal(decision.enabled, false);
  assert.equal(decision.path, "same-window");
  assert.equal(decision.reason, "kill-switch-force-disabled");
});

// ---------------------------------------------------------------------------
// 6. Schema defaults match the fallback defaults in the adapter
// ---------------------------------------------------------------------------

test("schema default values match readMigrationFlagsFromConfig fallback defaults", () => {
  const emptyFlags = readMigrationFlagsFromConfig(createStubConfigService({}));
  for (const schema of migrationFlagSchemas) {
    const flagName = Object.entries(MIGRATION_FLAG_KEYS).find(
      ([, key]) => key === schema.key,
    )?.[0];
    assert.ok(flagName, `Should find flag name for schema key "${schema.key}"`);
    assert.equal(
      schema.default,
      emptyFlags[flagName],
      `Schema default for "${schema.key}" should match adapter default`,
    );
  }
});
