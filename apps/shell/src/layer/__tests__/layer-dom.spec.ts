import { createLayerContainer, removeLayerContainer } from "../layer-dom.js";

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

// ---------------------------------------------------------------------------
// Minimal DOM mock — enough for createElement, querySelectorAll, insertBefore
// ---------------------------------------------------------------------------

interface MockEl {
  tagName: string;
  className: string;
  dataset: Record<string, string | undefined>;
  style: Record<string, string>;
  children: MockEl[];
  parentNode: MockEl | null;
  querySelector(sel: string): MockEl | null;
  querySelectorAll(sel: string): MockEl[];
  appendChild(child: MockEl): void;
  insertBefore(child: MockEl, ref: MockEl): void;
  remove(): void;
}

function makeMockEl(tag: string): MockEl {
  const el: MockEl = {
    tagName: tag.toUpperCase(),
    className: "",
    dataset: {},
    style: {},
    children: [],
    parentNode: null,
    querySelector(sel: string): MockEl | null {
      return matchSelector(el.children, sel, false)[0] ?? null;
    },
    querySelectorAll(sel: string): MockEl[] {
      return matchSelector(el.children, sel, true);
    },
    appendChild(child: MockEl) {
      child.parentNode = el;
      el.children.push(child);
    },
    insertBefore(child: MockEl, ref: MockEl) {
      child.parentNode = el;
      const idx = el.children.indexOf(ref);
      if (idx !== -1) {
        el.children.splice(idx, 0, child);
      } else {
        el.children.push(child);
      }
    },
    remove() {
      if (el.parentNode) {
        const idx = el.parentNode.children.indexOf(el);
        if (idx !== -1) el.parentNode.children.splice(idx, 1);
        el.parentNode = null;
      }
    },
  };
  return el;
}

/** Minimal selector matching for [data-z] and .shell-layer[data-layer="x"] */
function matchSelector(children: MockEl[], sel: string, all: boolean): MockEl[] {
  const results: MockEl[] = [];
  for (const child of children) {
    if (matchesSel(child, sel)) {
      results.push(child);
      if (!all) return results;
    }
  }
  return results;
}

function matchesSel(el: MockEl, sel: string): boolean {
  if (sel === "[data-z]") return el.dataset.z !== undefined;
  const m = sel.match(/\.shell-layer\[data-layer="(.+?)"\]/);
  if (m) return el.className.includes("shell-layer") && el.dataset.layer === m[1];
  return false;
}

// Install global document mock
const origDoc = (globalThis as Record<string, unknown>).document;
(globalThis as Record<string, unknown>).document = {
  createElement(tag: string) {
    return makeMockEl(tag);
  },
};

function makeHost(...zOrders: number[]): MockEl {
  const host = makeMockEl("div");
  for (const z of zOrders) {
    const el = makeMockEl("section");
    el.className = "shell-layer";
    el.dataset.z = String(z);
    el.dataset.layer = `layer-${z}`;
    host.appendChild(el);
  }
  return host;
}

function asEl(mock: MockEl): HTMLElement {
  return mock as unknown as HTMLElement;
}

// --- createLayerContainer ---

test("createLayerContainer inserts at correct z-order position", () => {
  const host = makeHost(0, 100, 300, 600);
  const el = createLayerContainer(asEl(host), { name: "custom", zOrder: 150 });
  const mock = el as unknown as MockEl;
  assertEqual(mock.dataset.layer, "custom", "should have correct data-layer");
  assertEqual(mock.dataset.z, "150", "should have correct data-z");
  const idx = host.children.indexOf(mock);
  assertEqual(idx, 2, "should be inserted between z=100 and z=300");
});

test("createLayerContainer appends when z-order is highest", () => {
  const host = makeHost(0, 100, 300);
  const el = createLayerContainer(asEl(host), { name: "top", zOrder: 999 });
  const mock = el as unknown as MockEl;
  assertEqual(host.children[host.children.length - 1], mock, "should be last child");
});

test("createLayerContainer sets correct attributes and style", () => {
  const host = makeHost();
  const el = createLayerContainer(asEl(host), { name: "test", zOrder: 42 });
  const mock = el as unknown as MockEl;
  assertEqual(mock.className, "shell-layer", "should have shell-layer class");
  assertEqual(mock.style.zIndex, "42", "should set z-index style");
  assertEqual(mock.tagName, "SECTION", "should be a section element");
});

// --- removeLayerContainer ---

test("removeLayerContainer removes the correct element", () => {
  const host = makeHost(0, 100, 300);
  removeLayerContainer(asEl(host), "layer-100");
  assertEqual(host.children.length, 2, "should have 2 children after removal");
});

test("removeLayerContainer is no-op for non-existent layer", () => {
  const host = makeHost(0, 100);
  removeLayerContainer(asEl(host), "nonexistent");
  assertEqual(host.children.length, 2, "should still have 2 children");
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

// Restore original document
if (origDoc !== undefined) {
  (globalThis as Record<string, unknown>).document = origDoc;
} else {
  delete (globalThis as Record<string, unknown>).document;
}

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
