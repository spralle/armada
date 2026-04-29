import { applyVisualEffects, setDynamicOpacity } from "../visual-effects.js";

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

function makeElement(): HTMLElement {
  const style: Record<string, string> = {};
  return { style } as unknown as HTMLElement;
}

// ---------------------------------------------------------------------------
// applyVisualEffects
// ---------------------------------------------------------------------------

test("applyVisualEffects with opacity only", () => {
  const el = makeElement();
  applyVisualEffects(el, 0.5);
  assertEqual(el.style.opacity, "0.5", "opacity");
  assertEqual(el.style.backdropFilter, "", "backdropFilter cleared");
});

test("applyVisualEffects with backdropFilter only", () => {
  const el = makeElement();
  applyVisualEffects(el, undefined, "blur(12px)");
  assertEqual(el.style.opacity, "", "opacity default");
  assertEqual(el.style.backdropFilter, "blur(12px)", "backdropFilter set");
  assertEqual((el.style as unknown as Record<string, string>).webkitBackdropFilter, "blur(12px)", "webkit prefix set");
});

test("applyVisualEffects with both", () => {
  const el = makeElement();
  applyVisualEffects(el, 0.8, "blur(8px)");
  assertEqual(el.style.opacity, "0.8", "opacity");
  assertEqual(el.style.backdropFilter, "blur(8px)", "backdropFilter");
  assertEqual((el.style as unknown as Record<string, string>).webkitBackdropFilter, "blur(8px)", "webkit prefix");
});

test("applyVisualEffects with defaults (no opacity, no filter)", () => {
  const el = makeElement();
  // Pre-set values to verify they get cleared
  el.style.opacity = "0.5";
  el.style.backdropFilter = "blur(4px)";
  (el.style as unknown as Record<string, string>).webkitBackdropFilter = "blur(4px)";

  applyVisualEffects(el);
  assertEqual(el.style.opacity, "", "opacity cleared");
  assertEqual(el.style.backdropFilter, "", "backdropFilter cleared");
  assertEqual((el.style as unknown as Record<string, string>).webkitBackdropFilter, "", "webkit prefix cleared");
});

test("applyVisualEffects with opacity=1 resets to default", () => {
  const el = makeElement();
  el.style.opacity = "0.5";
  applyVisualEffects(el, 1);
  assertEqual(el.style.opacity, "", "opacity=1 clears style");
});

// ---------------------------------------------------------------------------
// setDynamicOpacity
// ---------------------------------------------------------------------------

test("setDynamicOpacity sets value", () => {
  const el = makeElement();
  setDynamicOpacity(el, 0.7);
  assertEqual(el.style.opacity, "0.7", "opacity set");
});

test("setDynamicOpacity clamps below 0", () => {
  const el = makeElement();
  setDynamicOpacity(el, -0.5);
  assertEqual(el.style.opacity, "0", "clamped to 0");
});

test("setDynamicOpacity clamps above 1", () => {
  const el = makeElement();
  setDynamicOpacity(el, 1.5);
  assertEqual(el.style.opacity, "1", "clamped to 1");
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    t.run();
    passed += 1;
    console.log(`  ✓ ${t.name}`);
  } catch (err: unknown) {
    failed += 1;
    console.error(`  ✗ ${t.name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
