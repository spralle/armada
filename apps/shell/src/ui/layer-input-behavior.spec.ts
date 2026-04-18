import { InputBehavior, KeyboardInteractivity } from "@ghost/plugin-contracts";
import {
  applyInputBehavior,
  applyKeyboardInteractivity,
  createKeyboardExclusiveManager,
} from "./layer-input-behavior.js";

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
// Minimal DOM mocks (no jsdom/happy-dom dependency)
// ---------------------------------------------------------------------------

function makeStyleProxy(): Record<string, string> & CSSStyleDeclaration {
  const store: Record<string, string> = {};
  return new Proxy(store, {
    get(target, prop) {
      if (typeof prop === "string") return target[prop] ?? "";
      return undefined;
    },
    set(target, prop, value) {
      if (typeof prop === "string") target[prop] = value;
      return true;
    },
  }) as unknown as Record<string, string> & CSSStyleDeclaration;
}

interface MockDiv {
  style: Record<string, string> & CSSStyleDeclaration;
  dataset: Record<string, string | undefined>;
  tabIndex: number;
  focused: boolean;
  attributes: Record<string, string>;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  blur(): void;
  focus(): void;
  contains(node: unknown): boolean;
}

function makeDiv(): MockDiv {
  const attrs: Record<string, string> = {};
  const div: MockDiv = {
    style: makeStyleProxy(),
    dataset: {},
    tabIndex: -1,
    focused: false,
    attributes: attrs,
    setAttribute(name: string, value: string) {
      attrs[name] = value;
    },
    getAttribute(name: string) {
      return attrs[name] ?? null;
    },
    blur() {
      div.focused = false;
    },
    focus() {
      div.focused = true;
    },
    contains(node: unknown) {
      return node === div;
    },
  };
  return div;
}

// Cast helper — our mock satisfies the subset used by the implementation
function asHtmlDiv(mock: MockDiv): HTMLDivElement {
  return mock as unknown as HTMLDivElement;
}

// Patch global document for applyKeyboardInteractivity (checks document.activeElement)
const originalDocument = (globalThis as Record<string, unknown>).document;
let currentlyFocused: MockDiv | null = null;

function setupDocumentMock(): void {
  const listeners: Array<{ type: string; handler: (e: unknown) => void; capture: boolean }> = [];
  (globalThis as Record<string, unknown>).document = {
    get activeElement() {
      return currentlyFocused as unknown;
    },
    addEventListener(type: string, handler: (e: unknown) => void, capture?: boolean) {
      listeners.push({ type, handler, capture: !!capture });
    },
    removeEventListener(type: string, handler: (e: unknown) => void, capture?: boolean) {
      const idx = listeners.findIndex(
        (l) => l.type === type && l.handler === handler && l.capture === !!capture,
      );
      if (idx !== -1) listeners.splice(idx, 1);
    },
    /** Expose for test inspection */
    _listeners: listeners,
  };
}

function teardownDocumentMock(): void {
  currentlyFocused = null;
  if (originalDocument !== undefined) {
    (globalThis as Record<string, unknown>).document = originalDocument;
  } else {
    delete (globalThis as Record<string, unknown>).document;
  }
}

function makeFocusableDiv(): MockDiv {
  const div = makeDiv();
  const origFocus = div.focus.bind(div);
  div.focus = () => {
    origFocus();
    currentlyFocused = div;
  };
  const origBlur = div.blur.bind(div);
  div.blur = () => {
    origBlur();
    if (currentlyFocused === div) currentlyFocused = null;
  };
  return div;
}

// ---------------------------------------------------------------------------
// applyInputBehavior
// ---------------------------------------------------------------------------

test("applyInputBehavior opaque sets pointer-events auto", () => {
  const el = makeDiv();
  applyInputBehavior(asHtmlDiv(el), InputBehavior.Opaque);
  assertEqual(el.style.pointerEvents, "auto", "pointer-events");
  assertEqual(el.dataset.contentAware, undefined, "no content-aware marker");
});

test("applyInputBehavior passthrough sets pointer-events none", () => {
  const el = makeDiv();
  applyInputBehavior(asHtmlDiv(el), InputBehavior.Passthrough);
  assertEqual(el.style.pointerEvents, "none", "pointer-events");
});

test("applyInputBehavior content_aware sets pointer-events auto with marker", () => {
  const el = makeDiv();
  applyInputBehavior(asHtmlDiv(el), InputBehavior.ContentAware);
  assertEqual(el.style.pointerEvents, "auto", "pointer-events");
  assertEqual(el.dataset.contentAware, "true", "content-aware marker");
});

test("applyInputBehavior switching from content_aware to opaque removes marker", () => {
  const el = makeDiv();
  applyInputBehavior(asHtmlDiv(el), InputBehavior.ContentAware);
  applyInputBehavior(asHtmlDiv(el), InputBehavior.Opaque);
  assertEqual(el.dataset.contentAware, undefined, "marker removed");
});

// ---------------------------------------------------------------------------
// applyKeyboardInteractivity
// ---------------------------------------------------------------------------

test("applyKeyboardInteractivity none sets tabindex -1", () => {
  setupDocumentMock();
  try {
    const el = makeFocusableDiv();
    applyKeyboardInteractivity(asHtmlDiv(el), KeyboardInteractivity.None);
    assertEqual(el.getAttribute("tabindex"), "-1", "tabindex");
  } finally {
    teardownDocumentMock();
  }
});

test("applyKeyboardInteractivity on_demand sets tabindex 0", () => {
  setupDocumentMock();
  try {
    const el = makeFocusableDiv();
    applyKeyboardInteractivity(asHtmlDiv(el), KeyboardInteractivity.OnDemand);
    assertEqual(el.getAttribute("tabindex"), "0", "tabindex");
  } finally {
    teardownDocumentMock();
  }
});

test("applyKeyboardInteractivity exclusive focuses element", () => {
  setupDocumentMock();
  try {
    const el = makeFocusableDiv();
    applyKeyboardInteractivity(asHtmlDiv(el), KeyboardInteractivity.Exclusive);
    assertEqual(el.getAttribute("tabindex"), "0", "tabindex");
    assertEqual(el.focused, true, "element is focused");
  } finally {
    teardownDocumentMock();
  }
});

test("applyKeyboardInteractivity none blurs focused element", () => {
  setupDocumentMock();
  try {
    const el = makeFocusableDiv();
    el.focus();
    assertEqual(currentlyFocused, el, "precondition: focused");
    applyKeyboardInteractivity(asHtmlDiv(el), KeyboardInteractivity.None);
    assertEqual(el.focused, false, "element is blurred");
  } finally {
    teardownDocumentMock();
  }
});

// ---------------------------------------------------------------------------
// KeyboardExclusiveManager
// ---------------------------------------------------------------------------

test("pushExclusive installs capturing listeners on document", () => {
  setupDocumentMock();
  try {
    const manager = createKeyboardExclusiveManager();
    const el = makeFocusableDiv();
    manager.pushExclusive("s1", asHtmlDiv(el));

    const doc = (globalThis as Record<string, unknown>).document as {
      _listeners: Array<{ type: string; capture: boolean }>;
    };
    const capturingKeydown = doc._listeners.filter((l) => l.type === "keydown" && l.capture);
    assertEqual(capturingKeydown.length > 0, true, "capturing keydown listener installed");

    manager.dispose();
  } finally {
    teardownDocumentMock();
  }
});

test("popExclusive removes listeners when stack empty", () => {
  setupDocumentMock();
  try {
    const manager = createKeyboardExclusiveManager();
    const el = makeFocusableDiv();
    manager.pushExclusive("s1", asHtmlDiv(el));
    manager.popExclusive("s1");

    assertEqual(manager.getActiveExclusive(), null, "no active exclusive");

    const doc = (globalThis as Record<string, unknown>).document as {
      _listeners: Array<{ type: string; capture: boolean }>;
    };
    const capturingKeydown = doc._listeners.filter((l) => l.type === "keydown" && l.capture);
    assertEqual(capturingKeydown.length, 0, "listeners removed");

    manager.dispose();
  } finally {
    teardownDocumentMock();
  }
});

test("multiple exclusives stack correctly — last wins", () => {
  setupDocumentMock();
  try {
    const manager = createKeyboardExclusiveManager();
    const el1 = makeFocusableDiv();
    const el2 = makeFocusableDiv();

    manager.pushExclusive("s1", asHtmlDiv(el1));
    manager.pushExclusive("s2", asHtmlDiv(el2));

    assertEqual(manager.getActiveExclusive()?.surfaceId, "s2", "last pushed is active");

    manager.popExclusive("s2");
    assertEqual(manager.getActiveExclusive()?.surfaceId, "s1", "s1 is now active");

    manager.dispose();
  } finally {
    teardownDocumentMock();
  }
});

test("getActiveExclusive returns null when stack is empty", () => {
  const manager = createKeyboardExclusiveManager();
  assertEqual(manager.getActiveExclusive(), null, "empty stack");
  manager.dispose();
});

test("capturing listener suppresses events outside exclusive surface", () => {
  setupDocumentMock();
  try {
    const manager = createKeyboardExclusiveManager();
    const el = makeFocusableDiv();
    manager.pushExclusive("s1", asHtmlDiv(el));

    // Simulate the capturing handler behavior:
    // Get the installed handler and call it with a mock event outside the surface
    const doc = (globalThis as Record<string, unknown>).document as {
      _listeners: Array<{ type: string; handler: (e: unknown) => void; capture: boolean }>;
    };
    const capHandler = doc._listeners.find((l) => l.type === "keydown" && l.capture);

    let stopPropCalled = false;
    let stopImmediateCalled = false;
    const mockEvent = {
      target: { notTheSurface: true }, // not contained by el
      stopPropagation() { stopPropCalled = true; },
      stopImmediatePropagation() { stopImmediateCalled = true; },
    };

    capHandler!.handler(mockEvent);
    assertEqual(stopPropCalled, true, "stopPropagation called");
    assertEqual(stopImmediateCalled, true, "stopImmediatePropagation called");

    manager.dispose();
  } finally {
    teardownDocumentMock();
  }
});

test("capturing listener allows events inside exclusive surface", () => {
  setupDocumentMock();
  try {
    const manager = createKeyboardExclusiveManager();
    const el = makeFocusableDiv();
    manager.pushExclusive("s1", asHtmlDiv(el));

    const doc = (globalThis as Record<string, unknown>).document as {
      _listeners: Array<{ type: string; handler: (e: unknown) => void; capture: boolean }>;
    };
    const capHandler = doc._listeners.find((l) => l.type === "keydown" && l.capture);

    let stopPropCalled = false;
    const mockEvent = {
      target: asHtmlDiv(el), // the surface itself — contains returns true
      stopPropagation() { stopPropCalled = true; },
      stopImmediatePropagation() {},
    };

    capHandler!.handler(mockEvent);
    assertEqual(stopPropCalled, false, "stopPropagation NOT called for inside event");

    manager.dispose();
  } finally {
    teardownDocumentMock();
  }
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

console.log("layer-input-behavior tests:");
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
