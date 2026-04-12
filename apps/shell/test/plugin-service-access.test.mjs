import test from "node:test";
import assert from "node:assert/strict";
import { createServiceRegistry } from "../dist-test/src/service-registry.js";
import { THEME_SERVICE_ID } from "../../../packages/plugin-contracts/dist/index.js";

// ---------------------------------------------------------------------------
// Plugin service access — end-to-end flow
// ---------------------------------------------------------------------------
// Validates the pattern a plugin would use: create a registry, register a
// service, then access it via the PluginServices subset (getService/hasService).

test("plugin can access ThemeService via services.getService", () => {
  const registry = createServiceRegistry();

  // Simulate shell bootstrap registering a ThemeService
  const fakeThemeService = {
    listThemes: () => [{ id: "default", name: "Default", mode: "dark" }],
    getActiveThemeId: () => "default",
    setTheme: () => true,
    listBackgrounds: () => [],
    getActiveBackground: () => null,
    setBackground: () => false,
    setCustomBackground: () => {},
    clearCustomBackground: () => {},
  };

  registry.registerService(THEME_SERVICE_ID, fakeThemeService);

  // Plugin access pattern — only uses getService (PluginServices subset)
  const themeService = registry.getService(THEME_SERVICE_ID);
  assert.ok(themeService, "getService should return the registered service");
  assert.deepEqual(themeService.listThemes(), [
    { id: "default", name: "Default", mode: "dark" },
  ]);
  assert.equal(themeService.getActiveThemeId(), "default");
});

test("services.getService returns null when service not registered", () => {
  const registry = createServiceRegistry();
  const result = registry.getService("ghost.nonexistent.Service");
  assert.equal(result, null);
});

test("services.hasService reflects registration state", () => {
  const registry = createServiceRegistry();
  assert.equal(registry.hasService(THEME_SERVICE_ID), false);
  registry.registerService(THEME_SERVICE_ID, { listThemes: () => [] });
  assert.equal(registry.hasService(THEME_SERVICE_ID), true);
});

test("ShellServiceRegistry has PluginServices-compatible shape", () => {
  const registry = createServiceRegistry();

  // PluginServices requires: getService<T>(id: string): T | null
  assert.equal(typeof registry.getService, "function");

  // PluginServices requires: hasService(id: string): boolean
  assert.equal(typeof registry.hasService, "function");

  // Verify the structural contract: getService returns null for missing
  assert.equal(registry.getService("missing"), null);
  // hasService returns boolean
  assert.equal(registry.hasService("missing"), false);
});
