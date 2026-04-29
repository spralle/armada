import assert from "node:assert/strict";
import test from "node:test";
import { THEME_SERVICE_ID } from "../dist/index.js";

// ---------------------------------------------------------------------------
// PluginServices & PluginMountContext export verification
// ---------------------------------------------------------------------------
// PluginServices and PluginMountContext are type-only exports; they exist in
// the .d.ts but produce no runtime value. We verify the module loads without
// error and the re-exported constant is still accessible alongside the new
// exports.

test("plugin-contracts module loads with plugin-services exports", async () => {
  const mod = await import("../dist/index.js");
  assert.ok(mod, "module should load successfully");
});

test("THEME_SERVICE_ID remains accessible alongside new exports", () => {
  assert.equal(THEME_SERVICE_ID, "ghost.theme.Service");
});

test("plugin-services.js dist file is importable", async () => {
  const mod = await import("../dist/plugin-services.js");
  assert.ok(mod, "plugin-services module should load");
  // Both interfaces are type-only, so no runtime keys expected beyond default
  // module metadata. The important thing is no import error.
});
