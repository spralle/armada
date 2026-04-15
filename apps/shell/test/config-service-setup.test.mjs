import test from "node:test";
import assert from "node:assert/strict";
import {
  createShellConfigService,
  runPersistenceMigrations,
} from "../dist-test/src/config-service-setup.js";

// ---------------------------------------------------------------------------
// Stub ConfigurationService — minimal mock for migration tests
// ---------------------------------------------------------------------------

function createStubConfigService(entries = {}) {
  const store = { ...entries };
  return {
    get(key) {
      return Object.hasOwn(store, key) ? store[key] : undefined;
    },
    getWithDefault(key, defaultValue) {
      const v = store[key];
      return v !== undefined ? v : defaultValue;
    },
    getAtLayer() { return undefined; },
    getForScope() { return undefined; },
    inspect(key) {
      return { key, effectiveValue: store[key], effectiveLayer: undefined };
    },
    set(key, value) { store[key] = value; },
    remove(key) { delete store[key]; },
    onChange() { return () => {}; },
    getNamespace() { return {}; },
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// 1. createShellConfigService returns a config service with session controller
// ---------------------------------------------------------------------------

test("createShellConfigService returns configService and sessionController", async () => {
  const result = await createShellConfigService();

  assert.ok(result.configService, "should return a configService");
  assert.ok(result.sessionController, "should return a sessionController");

  // ConfigService has expected interface
  assert.equal(typeof result.configService.get, "function", "configService.get should be a function");
  assert.equal(typeof result.configService.set, "function", "configService.set should be a function");
  assert.equal(typeof result.configService.onChange, "function", "configService.onChange should be a function");

  // SessionController has expected interface
  assert.equal(typeof result.sessionController.activate, "function", "sessionController.activate");
  assert.equal(typeof result.sessionController.deactivate, "function", "sessionController.deactivate");
  assert.equal(typeof result.sessionController.isActive, "function", "sessionController.isActive");
  assert.equal(typeof result.sessionController.getSession, "function", "sessionController.getSession");
});

// ---------------------------------------------------------------------------
// 2. Session controller is accessible via configService.session
// ---------------------------------------------------------------------------

test("configService.session is wired to the session controller", async () => {
  const result = await createShellConfigService();

  assert.ok(result.configService.session, "configService.session should be defined");
  assert.equal(
    typeof result.configService.session.activate,
    "function",
    "session handle should have activate",
  );
  assert.equal(
    typeof result.configService.session.isActive,
    "function",
    "session handle should have isActive",
  );

  // Initially no active session
  assert.equal(result.configService.session.isActive(), false, "no active session initially");
  assert.equal(result.configService.session.getSession(), null, "getSession returns null initially");
});

// ---------------------------------------------------------------------------
// 3. Session activation flows through to config service writes
// ---------------------------------------------------------------------------

test("session activation allows writes to session layer", async () => {
  const result = await createShellConfigService();
  const { configService, sessionController } = result;

  // Activate session
  const session = sessionController.activate({ reason: "test" });
  assert.ok(session.id, "session should have an id");
  assert.equal(session.isActive, true, "session should be active");

  // Write via session layer
  configService.set("test.key", "test-value", "session");
  assert.equal(configService.get("test.key"), "test-value", "should read session value");

  // Deactivate session
  const deactivation = sessionController.deactivate();
  assert.ok(deactivation.sessionId, "deactivation should report session id");
  assert.equal(deactivation.overridesCleared, 1, "should clear 1 override");

  // Clean up
  sessionController.dispose();
});

// ---------------------------------------------------------------------------
// 4. Core defaults layer is present
// ---------------------------------------------------------------------------

test("config service has core defaults layer loaded", async () => {
  const result = await createShellConfigService();

  // Core layer exists (empty data, but should not throw)
  const coreValue = result.configService.getAtLayer("core", "nonexistent.key");
  assert.equal(coreValue, undefined, "non-existent core key returns undefined");

  result.sessionController.dispose();
});

// ---------------------------------------------------------------------------
// 5. runPersistenceMigrations handles missing storage gracefully
// ---------------------------------------------------------------------------

test("runPersistenceMigrations returns results without throwing", () => {
  const configService = createStubConfigService({});

  // In test environment, getStorage() may return undefined (no window.localStorage)
  // The function should handle this gracefully
  const results = runPersistenceMigrations(configService);

  assert.ok(results, "should return results object");
  assert.equal(typeof results.layout.migrated, "boolean", "layout.migrated should be boolean");
  assert.equal(typeof results.context.migrated, "boolean", "context.migrated should be boolean");
  assert.equal(typeof results.keybindings.migrated, "boolean", "keybindings.migrated should be boolean");
});

// ---------------------------------------------------------------------------
// 6. runPersistenceMigrations reports no migration when storage is empty
// ---------------------------------------------------------------------------

test("runPersistenceMigrations reports source=none when no data to migrate", () => {
  const configService = createStubConfigService({});

  const results = runPersistenceMigrations(configService);

  assert.equal(results.layout.migrated, false, "layout should not migrate");
  assert.equal(results.layout.source, "none", "layout source should be none");
  assert.equal(results.context.migrated, false, "context should not migrate");
  assert.equal(results.context.source, "none", "context source should be none");
  assert.equal(results.keybindings.migrated, false, "keybindings should not migrate");
  assert.equal(results.keybindings.source, "none", "keybindings source should be none");
});

// ---------------------------------------------------------------------------
// 7. runPersistenceMigrations survives individual bridge failures
// ---------------------------------------------------------------------------

test("runPersistenceMigrations continues when individual bridges throw", () => {
  // A config service that throws on get() — simulates total failure
  const throwingService = {
    get() { throw new Error("Service offline"); },
    getWithDefault() { throw new Error("Service offline"); },
    getAtLayer() { throw new Error("Service offline"); },
    getForScope() { throw new Error("Service offline"); },
    inspect() { throw new Error("Service offline"); },
    set() { throw new Error("Service offline"); },
    remove() { throw new Error("Service offline"); },
    onChange() { return () => {}; },
    getNamespace() { return {}; },
  };

  // Should not throw — each bridge failure is caught independently
  const results = runPersistenceMigrations(throwingService);

  assert.ok(results, "should return results even when bridges fail");
  assert.equal(results.layout.migrated, false, "layout should not migrate on failure");
  assert.equal(results.context.migrated, false, "context should not migrate on failure");
  assert.equal(results.keybindings.migrated, false, "keybindings should not migrate on failure");
});
