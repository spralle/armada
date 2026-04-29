import type { PluginLayerSurfaceContribution } from "@ghost-shell/contracts/layer";
import { LayerRegistry } from "../registry.js";

type TestCase = { name: string; run: () => void };
const tests: TestCase[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${message}. expected=${e} actual=${a}`);
  }
}

function makeSurface(overrides: Partial<PluginLayerSurfaceContribution> = {}): PluginLayerSurfaceContribution {
  return {
    id: "test-surface",
    component: "./TestComponent",
    layer: "floating",
    anchor: 1,
    ...overrides,
  };
}

// --- Built-in layer registration ---

test("registerBuiltinLayers registers 7 layers", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  const layers = reg.getOrderedLayers();
  assertEqual(layers.length, 7, "should have 7 built-in layers");
});

test("built-in layers have correct z-orders", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  const layers = reg.getOrderedLayers();
  const zOrders = layers.map((l) => l.zOrder);
  assertDeepEqual(zOrders, [0, 100, 200, 300, 400, 500, 600], "z-orders should match");
});

test("built-in layers have correct names in order", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  const names = reg.getOrderedLayers().map((l) => l.name);
  assertDeepEqual(
    names,
    ["background", "bottom", "main", "floating", "notification", "modal", "overlay"],
    "names should match",
  );
});

// --- Plugin layer registration ---

test("registerPluginLayers adds custom layers", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  const result = reg.registerPluginLayers("plugin-a", [{ name: "custom", zOrder: 150 }]);
  assertEqual(result.registered.length, 1, "should register 1 layer");
  assertEqual(result.denied.length, 0, "should deny 0 layers");
  assertEqual(reg.getLayer("custom")?.pluginId, "plugin-a", "pluginId should be set");
});

test("registerPluginLayers denies name conflicts with built-ins", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  const result = reg.registerPluginLayers("plugin-a", [{ name: "main", zOrder: 999 }]);
  assertEqual(result.registered.length, 0, "should register 0 layers");
  assertEqual(result.denied.length, 1, "should deny 1 layer");
  assertEqual(result.denied[0]?.name, "main", "denied name should be 'main'");
});

test("registerPluginLayers denies name conflicts with other plugins", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  reg.registerPluginLayers("plugin-a", [{ name: "custom", zOrder: 150 }]);
  const result = reg.registerPluginLayers("plugin-b", [{ name: "custom", zOrder: 250 }]);
  assertEqual(result.denied.length, 1, "should deny duplicate name");
});

// --- z-order collision detection ---

test("registerPluginLayers denies z-order conflicts with built-ins", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  const result = reg.registerPluginLayers("plugin-a", [{ name: "custom", zOrder: 200 }]);
  assertEqual(result.registered.length, 0, "should register 0 layers");
  assertEqual(result.denied.length, 1, "should deny 1 layer");
  assertEqual(result.denied[0]?.reason.includes("z-order 200"), true, "reason should mention z-order");
  assertEqual(result.denied[0]?.reason.includes("main"), true, "reason should mention conflicting layer");
});

test("registerPluginLayers denies z-order conflicts with other plugins", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  reg.registerPluginLayers("plugin-a", [{ name: "custom-a", zOrder: 150 }]);
  const result = reg.registerPluginLayers("plugin-b", [{ name: "custom-b", zOrder: 150 }]);
  assertEqual(result.registered.length, 0, "should register 0 layers");
  assertEqual(result.denied.length, 1, "should deny 1 layer");
  assertEqual(result.denied[0]?.reason.includes("z-order 150"), true, "reason should mention z-order");
  assertEqual(result.denied[0]?.reason.includes("custom-a"), true, "reason should mention conflicting layer");
});

// --- getOrderedLayers sorting ---

test("getOrderedLayers includes plugin layers sorted by zOrder", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  reg.registerPluginLayers("plugin-a", [{ name: "custom", zOrder: 150 }]);
  const layers = reg.getOrderedLayers();
  assertEqual(layers.length, 8, "should have 8 layers");
  assertEqual(layers[2]?.name, "custom", "custom layer at z=150 should be third");
});

// --- Cascade removal ---

test("unregisterPluginLayers removes layers and cascades surfaces", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  reg.registerPluginLayers("plugin-a", [{ name: "custom", zOrder: 150 }]);
  // Register surfaces from different plugins on the custom layer
  reg.registerSurface("plugin-a", makeSurface({ id: "s1", layer: "custom" }));
  reg.registerSurface("plugin-b", makeSurface({ id: "s2", layer: "custom" }));
  // Also a surface on a built-in layer (should NOT be affected)
  reg.registerSurface("plugin-a", makeSurface({ id: "s3", layer: "floating" }));

  const result = reg.unregisterPluginLayers("plugin-a");
  assertDeepEqual(result.removedLayers, ["custom"], "should remove custom layer");
  assertEqual(result.affectedSurfaceIds.length, 2, "should cascade-remove 2 surfaces");
  assertEqual(reg.getLayer("custom"), undefined, "custom layer should be gone");
  assertEqual(reg.getAllSurfaces().length, 1, "only s3 should remain");
});

// --- Surface validation ---

test("validateSurfaceContribution rejects non-existent layer", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  const result = reg.validateSurfaceContribution(makeSurface({ layer: "nonexistent" }));
  assertEqual(result.valid, false, "should be invalid");
});

test("validateSurfaceContribution rejects non-contributable layer", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  const result = reg.validateSurfaceContribution(makeSurface({ layer: "main" }));
  assertEqual(result.valid, false, "main layer is not contributable");
});

test("validateSurfaceContribution rejects sessionLock on non-supporting layer", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  const result = reg.validateSurfaceContribution(makeSurface({ layer: "floating", sessionLock: true }));
  assertEqual(result.valid, false, "floating does not support session lock");
});

test("validateSurfaceContribution accepts sessionLock on overlay", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  const result = reg.validateSurfaceContribution(makeSurface({ layer: "overlay", sessionLock: true }));
  assertEqual(result.valid, true, "overlay supports session lock");
});

test("validateSurfaceContribution accepts valid surface", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  const result = reg.validateSurfaceContribution(makeSurface({ layer: "floating" }));
  assertEqual(result.valid, true, "should be valid");
});

// --- Surface registration and unregistration ---

test("registerSurface rejects invalid surfaces", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  const result = reg.registerSurface("plugin-a", makeSurface({ layer: "main" }));
  assertEqual(result.success, false, "should reject");
});

test("unregisterSurfaces removes only surfaces from specified plugin", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  reg.registerSurface("plugin-a", makeSurface({ id: "s1", layer: "floating" }));
  reg.registerSurface("plugin-b", makeSurface({ id: "s2", layer: "floating" }));
  const removed = reg.unregisterSurfaces("plugin-a");
  assertDeepEqual(removed, ["s1"], "should remove only plugin-a surfaces");
  assertEqual(reg.getAllSurfaces().length, 1, "should have 1 surface left");
});

test("getSurfacesForLayer returns matching surfaces", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  reg.registerSurface("plugin-a", makeSurface({ id: "s1", layer: "floating" }));
  reg.registerSurface("plugin-a", makeSurface({ id: "s2", layer: "notification" }));
  const surfaces = reg.getSurfacesForLayer("floating");
  assertEqual(surfaces.length, 1, "should have 1 surface on floating");
  assertEqual(surfaces[0]?.surface.id, "s1", "should be s1");
});

// --- Session lock check integration ---

test("sessionLockCheck rejects surfaces during active lock", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  reg.setSessionLockCheck((zOrder) => zOrder <= 600);
  // floating is z=300, should pass
  const r1 = reg.validateSurfaceContribution(makeSurface({ layer: "floating" }));
  assertEqual(r1.valid, true, "z=300 should pass when lock allows <=600");

  // Now simulate lock blocking everything above z=0
  reg.setSessionLockCheck((_zOrder) => false);
  const r2 = reg.validateSurfaceContribution(makeSurface({ layer: "floating" }));
  assertEqual(r2.valid, false, "should reject when lock check returns false");
  assertEqual(r2.reason?.includes("Session lock active"), true, "reason should mention session lock");
});

test("no sessionLockCheck set — surfaces pass as before", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  const result = reg.validateSurfaceContribution(makeSurface({ layer: "floating" }));
  assertEqual(result.valid, true, "should pass without session lock check");
});

// --- onSurfacesRemoved callback ---

test("onSurfacesRemoved fires on unregisterPluginLayers", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  reg.registerPluginLayers("plugin-a", [{ name: "custom", zOrder: 150 }]);
  reg.registerSurface("plugin-a", makeSurface({ id: "s1", layer: "custom" }));
  reg.registerSurface("plugin-b", makeSurface({ id: "s2", layer: "custom" }));

  const removedEntries: Array<{ surfaceId: string; pluginId: string }> = [];
  reg.setOnSurfacesRemoved((entries) => {
    removedEntries.push(...entries);
  });

  reg.unregisterPluginLayers("plugin-a");
  assertEqual(removedEntries.length, 2, "should fire callback with 2 entries");
});

test("onSurfacesRemoved fires on unregisterSurfaces", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  reg.registerSurface("plugin-a", makeSurface({ id: "s1", layer: "floating" }));
  reg.registerSurface("plugin-a", makeSurface({ id: "s2", layer: "notification" }));

  const removedEntries: Array<{ surfaceId: string; pluginId: string }> = [];
  reg.setOnSurfacesRemoved((entries) => {
    removedEntries.push(...entries);
  });

  reg.unregisterSurfaces("plugin-a");
  assertEqual(removedEntries.length, 2, "should fire callback with 2 entries");
  assertEqual(removedEntries[0]?.pluginId, "plugin-a", "pluginId should match");
});

test("no onSurfacesRemoved callback set — no error on unregister", () => {
  const reg = new LayerRegistry();
  reg.registerBuiltinLayers();
  reg.registerSurface("plugin-a", makeSurface({ id: "s1", layer: "floating" }));
  // Should not throw
  reg.unregisterSurfaces("plugin-a");
  assertEqual(reg.getAllSurfaces().length, 0, "surfaces should be removed");
});

// --- Run all tests ---

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    t.run();
    passed++;
    console.log(`  ✓ ${t.name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${t.name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
