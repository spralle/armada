import { AnchorEdge } from "@ghost/plugin-contracts";
import type { PluginLayerSurfaceContribution } from "@ghost/plugin-contracts";
import { computeAnchorStyles, computeExclusiveZones, getAnchorKey } from "./layer-anchor-positioning.js";

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
  const a = JSON.stringify(actual, Object.keys(actual as Record<string, unknown>).sort());
  const e = JSON.stringify(expected, Object.keys(expected as Record<string, unknown>).sort());
  if (a !== e) {
    throw new Error(`${message}.\n  expected=${e}\n  actual=${a}`);
  }
}

function makeSurface(overrides: Partial<PluginLayerSurfaceContribution> = {}): PluginLayerSurfaceContribution {
  return {
    id: "test-surface",
    component: "./TestComponent",
    layer: "floating",
    anchor: AnchorEdge.None,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeAnchorStyles – all 16 anchor combinations
// ---------------------------------------------------------------------------

test("anchor 0 (None) → centered", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: 0 }));
  assertEqual(s.position, "absolute", "position");
  assertEqual(s.top, "50%", "top");
  assertEqual(s.left, "50%", "left");
  assertEqual(s.transform, "translate(-50%,-50%)", "transform");
  assertEqual(s.width, "auto", "width");
  assertEqual(s.height, "auto", "height");
});

test("anchor 1 (Top) → top edge, fill width", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top }));
  assertEqual(s.position, "absolute", "position");
  assertEqual(s.top, "0px", "top");
  assertEqual(s.left, "0px", "left");
  assertEqual(s.right, "0px", "right");
  assertEqual(s.height, "auto", "height");
  assertEqual(s.width, undefined, "width should not be set");
});

test("anchor 2 (Bottom) → bottom edge, fill width", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Bottom }));
  assertEqual(s.bottom, "0px", "bottom");
  assertEqual(s.left, "0px", "left");
  assertEqual(s.right, "0px", "right");
  assertEqual(s.height, "auto", "height");
});

test("anchor 3 (Top+Bottom) → fill height, centered horiz", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Bottom }));
  assertEqual(s.top, "0px", "top");
  assertEqual(s.bottom, "0px", "bottom");
  assertEqual(s.left, "50%", "left centered");
  assertEqual(s.transform, "translateX(-50%)", "transform");
  assertEqual(s.width, "auto", "width");
  assertEqual(s.height, undefined, "height should not be set");
});

test("anchor 4 (Left) → left edge, fill height", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Left }));
  assertEqual(s.left, "0px", "left");
  assertEqual(s.top, "0px", "top");
  assertEqual(s.bottom, "0px", "bottom");
  assertEqual(s.width, "auto", "width");
});

test("anchor 5 (Top+Left) → top-left corner", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Left }));
  assertEqual(s.top, "0px", "top");
  assertEqual(s.left, "0px", "left");
  assertEqual(s.width, "auto", "width");
  assertEqual(s.height, "auto", "height");
});

test("anchor 6 (Bottom+Left) → bottom-left corner", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Bottom | AnchorEdge.Left }));
  assertEqual(s.bottom, "0px", "bottom");
  assertEqual(s.left, "0px", "left");
  assertEqual(s.width, "auto", "width");
  assertEqual(s.height, "auto", "height");
});

test("anchor 7 (Top+Bottom+Left) → left panel, fill height", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left }));
  assertEqual(s.top, "0px", "top");
  assertEqual(s.bottom, "0px", "bottom");
  assertEqual(s.left, "0px", "left");
  assertEqual(s.width, "auto", "width");
  assertEqual(s.height, undefined, "height should not be set");
});

test("anchor 8 (Right) → right edge, fill height", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Right }));
  assertEqual(s.right, "0px", "right");
  assertEqual(s.top, "0px", "top");
  assertEqual(s.bottom, "0px", "bottom");
  assertEqual(s.width, "auto", "width");
});

test("anchor 9 (Top+Right) → top-right corner", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Right }));
  assertEqual(s.top, "0px", "top");
  assertEqual(s.right, "0px", "right");
  assertEqual(s.width, "auto", "width");
  assertEqual(s.height, "auto", "height");
});

test("anchor 10 (Bottom+Right) → bottom-right corner", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Bottom | AnchorEdge.Right }));
  assertEqual(s.bottom, "0px", "bottom");
  assertEqual(s.right, "0px", "right");
  assertEqual(s.width, "auto", "width");
  assertEqual(s.height, "auto", "height");
});

test("anchor 11 (Top+Bottom+Right) → right panel, fill height", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Right }));
  assertEqual(s.top, "0px", "top");
  assertEqual(s.bottom, "0px", "bottom");
  assertEqual(s.right, "0px", "right");
  assertEqual(s.width, "auto", "width");
});

test("anchor 12 (Left+Right) → fill width, centered vert", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Left | AnchorEdge.Right }));
  assertEqual(s.left, "0px", "left");
  assertEqual(s.right, "0px", "right");
  assertEqual(s.top, "50%", "top centered");
  assertEqual(s.transform, "translateY(-50%)", "transform");
  assertEqual(s.height, "auto", "height");
});

test("anchor 13 (Top+Left+Right) → top panel, fill width", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Left | AnchorEdge.Right }));
  assertEqual(s.top, "0px", "top");
  assertEqual(s.left, "0px", "left");
  assertEqual(s.right, "0px", "right");
  assertEqual(s.height, "auto", "height");
});

test("anchor 14 (Bottom+Left+Right) → bottom panel, fill width", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right }));
  assertEqual(s.bottom, "0px", "bottom");
  assertEqual(s.left, "0px", "left");
  assertEqual(s.right, "0px", "right");
  assertEqual(s.height, "auto", "height");
});

test("anchor 15 (all edges) → fill entire layer", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right }));
  assertEqual(s.top, "0px", "top");
  assertEqual(s.right, "0px", "right");
  assertEqual(s.bottom, "0px", "bottom");
  assertEqual(s.left, "0px", "left");
  assertEqual(s.width, undefined, "width should not be set");
  assertEqual(s.height, undefined, "height should not be set");
});

// ---------------------------------------------------------------------------
// Margin application
// ---------------------------------------------------------------------------

test("margins are applied correctly", () => {
  const s = computeAnchorStyles(makeSurface({
    anchor: AnchorEdge.Top | AnchorEdge.Left,
    margin: { top: 10, left: 20, right: 5, bottom: 15 },
  }));
  assertEqual(s.top, "10px", "top margin");
  assertEqual(s.left, "20px", "left margin");
});

test("margins on fill-width anchor", () => {
  const s = computeAnchorStyles(makeSurface({
    anchor: AnchorEdge.Top,
    margin: { top: 8, left: 16, right: 16 },
  }));
  assertEqual(s.top, "8px", "top");
  assertEqual(s.left, "16px", "left");
  assertEqual(s.right, "16px", "right");
});

// ---------------------------------------------------------------------------
// Size as number vs string
// ---------------------------------------------------------------------------

test("size as number appends px", () => {
  const s = computeAnchorStyles(makeSurface({
    anchor: AnchorEdge.Top | AnchorEdge.Left,
    size: { width: 300, height: 200 },
  }));
  assertEqual(s.width, "300px", "width");
  assertEqual(s.height, "200px", "height");
});

test("size as string used as-is", () => {
  const s = computeAnchorStyles(makeSurface({
    anchor: AnchorEdge.Top | AnchorEdge.Left,
    size: { width: "50vw", height: "100%" },
  }));
  assertEqual(s.width, "50vw", "width");
  assertEqual(s.height, "100%", "height");
});

// ---------------------------------------------------------------------------
// Default margins and sizes
// ---------------------------------------------------------------------------

test("defaults: no margin → 0px, no size → auto", () => {
  const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Left }));
  assertEqual(s.top, "0px", "top default margin");
  assertEqual(s.left, "0px", "left default margin");
  assertEqual(s.width, "auto", "default width");
  assertEqual(s.height, "auto", "default height");
});

// ---------------------------------------------------------------------------
// computeExclusiveZones
// ---------------------------------------------------------------------------

test("exclusive zone: single top surface", () => {
  const zones = computeExclusiveZones([
    { surface: makeSurface({ anchor: AnchorEdge.Top, exclusiveZone: 40 }), pluginId: "p1" },
  ]);
  assertDeepEqual(zones, { top: 40, right: 0, bottom: 0, left: 0 }, "single top");
});

test("exclusive zone: multiple surfaces same edge → max wins", () => {
  const zones = computeExclusiveZones([
    { surface: makeSurface({ anchor: AnchorEdge.Top, exclusiveZone: 40 }), pluginId: "p1" },
    { surface: makeSurface({ anchor: AnchorEdge.Top, exclusiveZone: 60 }), pluginId: "p2" },
  ]);
  assertEqual(zones.top, 60, "max wins");
});

test("exclusive zone: multiple edges", () => {
  const zones = computeExclusiveZones([
    { surface: makeSurface({ anchor: AnchorEdge.Top, exclusiveZone: 30 }), pluginId: "p1" },
    { surface: makeSurface({ anchor: AnchorEdge.Left, exclusiveZone: 50 }), pluginId: "p2" },
    { surface: makeSurface({ anchor: AnchorEdge.Bottom, exclusiveZone: 20 }), pluginId: "p3" },
  ]);
  assertDeepEqual(zones, { top: 30, right: 0, bottom: 20, left: 50 }, "multiple edges");
});

test("exclusive zone: exclusiveZone=0 excluded", () => {
  const zones = computeExclusiveZones([
    { surface: makeSurface({ anchor: AnchorEdge.Top, exclusiveZone: 0 }), pluginId: "p1" },
  ]);
  assertDeepEqual(zones, { top: 0, right: 0, bottom: 0, left: 0 }, "ez=0 excluded");
});

test("exclusive zone: exclusiveZone=-1 excluded", () => {
  const zones = computeExclusiveZones([
    { surface: makeSurface({ anchor: AnchorEdge.Top, exclusiveZone: -1 }), pluginId: "p1" },
  ]);
  assertDeepEqual(zones, { top: 0, right: 0, bottom: 0, left: 0 }, "ez=-1 excluded");
});

test("exclusive zone: ambiguous anchor (top+bottom) → no reservation", () => {
  const zones = computeExclusiveZones([
    { surface: makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Bottom, exclusiveZone: 50 }), pluginId: "p1" },
  ]);
  assertDeepEqual(zones, { top: 0, right: 0, bottom: 0, left: 0 }, "ambiguous no reserve");
});

test("exclusive zone: top+left anchor → top edge reservation", () => {
  const zones = computeExclusiveZones([
    { surface: makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Left, exclusiveZone: 30 }), pluginId: "p1" },
  ]);
  // Top without bottom → top edge. Left without right → also left edge.
  // Implementation: first matching condition wins (top takes priority).
  assertEqual(zones.top, 30, "top edge from top+left");
});

// ---------------------------------------------------------------------------
// getAnchorKey
// ---------------------------------------------------------------------------

test("anchor key: 0 → center", () => {
  assertEqual(getAnchorKey(0), "center", "none");
});

test("anchor key: Top → top", () => {
  assertEqual(getAnchorKey(AnchorEdge.Top), "top", "top");
});

test("anchor key: Top+Right → top-right", () => {
  assertEqual(getAnchorKey(AnchorEdge.Top | AnchorEdge.Right), "top-right", "top-right");
});

test("anchor key: Top+Left → top-left", () => {
  assertEqual(getAnchorKey(AnchorEdge.Top | AnchorEdge.Left), "top-left", "top-left");
});

test("anchor key: all edges → top-bottom-left-right", () => {
  assertEqual(
    getAnchorKey(AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right),
    "top-bottom-left-right",
    "all",
  );
});

test("anchor key: Bottom+Left+Right → bottom-left-right", () => {
  assertEqual(
    getAnchorKey(AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right),
    "bottom-left-right",
    "bottom-left-right",
  );
});

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.run();
    passed++;
    console.log(`  ✓ ${t.name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${t.name}: ${(err as Error).message}`);
  }
}
console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total`);
if (failed > 0) process.exit(1);
