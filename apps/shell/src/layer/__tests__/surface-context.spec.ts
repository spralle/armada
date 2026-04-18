import { createLayerSurfaceContext } from "../surface-context.js";
import type { LayerSurfaceContextOptions } from "../surface-context.js";
import type { FocusGrabManager, FocusGrabOptions } from "../focus-grab.js";
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

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------------------
// Minimal DOM / global mocks
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

interface MockElement {
  style: Record<string, string> & CSSStyleDeclaration;
  _computedVars: Record<string, string>;
}

function makeMockElement(computedVars?: Record<string, string>): MockElement & HTMLDivElement {
  return {
    style: makeStyleProxy(),
    _computedVars: computedVars ?? {},
    focus() {},
    tagName: "DIV",
  } as unknown as MockElement & HTMLDivElement;
}

// ResizeObserver mock
let capturedResizeCallback: ((entries: Array<{ contentRect: { width: number; height: number } }>) => void) | null = null;
let resizeObserverDisconnected = false;
let resizeObserverTarget: unknown = null;

class MockResizeObserver {
  private callback: (entries: Array<{ contentRect: { width: number; height: number } }>) => void;

  constructor(callback: (entries: Array<{ contentRect: { width: number; height: number } }>) => void) {
    this.callback = callback;
    capturedResizeCallback = callback;
    resizeObserverDisconnected = false;
  }

  observe(target: unknown): void {
    resizeObserverTarget = target;
  }

  disconnect(): void {
    resizeObserverDisconnected = true;
    capturedResizeCallback = null;
  }

  unobserve(): void {}
}

// getComputedStyle mock
const originalGetComputedStyle = globalThis.getComputedStyle;

// Install global mocks
(globalThis as unknown as Record<string, unknown>).ResizeObserver = MockResizeObserver;

// ---------------------------------------------------------------------------
// Mock FocusGrabManager
// ---------------------------------------------------------------------------

interface GrabCall {
  surfaceId: string;
  surfaceElement: unknown;
  layerContainer: unknown;
  config: unknown;
}

function makeMockFocusGrabManager(): FocusGrabManager & { grabCalls: GrabCall[]; releaseCalls: string[] } {
  const grabCalls: GrabCall[] = [];
  const releaseCalls: string[] = [];
  return {
    grabCalls,
    releaseCalls,
    grabFocus(options: FocusGrabOptions): void {
      grabCalls.push({
        surfaceId: options.surfaceId,
        surfaceElement: options.surfaceElement,
        layerContainer: options.layerContainer,
        config: options.config,
      });
    },
    releaseFocus(surfaceId: string): void {
      releaseCalls.push(surfaceId);
    },
    getActiveGrab() {
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: create default options
// ---------------------------------------------------------------------------

function makeOptions(overrides?: Partial<LayerSurfaceContextOptions>): LayerSurfaceContextOptions & {
  _focusGrabManager: ReturnType<typeof makeMockFocusGrabManager>;
  _onDismissCalls: number;
  _onLayerChangeCalls: string[];
  _onExclusiveZoneChangeCalls: number[];
} {
  const fgm = makeMockFocusGrabManager();
  const registry = new LayerRegistry();
  registry.registerBuiltinLayers();

  const onLayerChangeCalls: string[] = [];
  const onExclusiveZoneChangeCalls: number[] = [];
  let onDismissCalls = 0;

  const containerVars: Record<string, string> = {};
  const container = makeMockElement(containerVars);

  // Install getComputedStyle mock for this container
  (globalThis as unknown as Record<string, unknown>).getComputedStyle = (el: unknown) => {
    if (el === container) {
      return {
        getPropertyValue(prop: string) {
          return containerVars[prop] ?? "";
        },
      } as CSSStyleDeclaration;
    }
    return { getPropertyValue: () => "" } as unknown as CSSStyleDeclaration;
  };

  const opts: LayerSurfaceContextOptions = {
    surfaceId: "test-surface-1",
    element: makeMockElement() as unknown as HTMLDivElement,
    layerName: "overlay",
    layerContainer: container as unknown as HTMLElement,
    layerRegistry: registry,
    focusGrabManager: fgm,
    onDismiss: () => { onDismissCalls++; },
    onLayerChange: (name: string) => { onLayerChangeCalls.push(name); },
    onExclusiveZoneChange: (value: number) => { onExclusiveZoneChangeCalls.push(value); },
    ...overrides,
  };

  return {
    ...opts,
    _focusGrabManager: fgm,
    get _onDismissCalls() { return onDismissCalls; },
    _onLayerChangeCalls: onLayerChangeCalls,
    _onExclusiveZoneChangeCalls: onExclusiveZoneChangeCalls,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("context exposes surfaceId and layerName", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);
  assertEqual(ctx.surfaceId, "test-surface-1", "surfaceId");
  assertEqual(ctx.layerName, "overlay", "layerName");
});

test("onConfigure registers ResizeObserver on element", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);
  capturedResizeCallback = null;
  resizeObserverTarget = null;

  ctx.onConfigure(() => {});
  assert(capturedResizeCallback !== null, "ResizeObserver should be created");
  assertEqual(resizeObserverTarget, opts.element, "should observe the surface element");
});

test("onConfigure fires callback on size change", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);
  const sizes: Array<{ width: number; height: number }> = [];

  ctx.onConfigure((rect) => sizes.push(rect));

  assert(capturedResizeCallback !== null, "callback should be captured");
  capturedResizeCallback!([{ contentRect: { width: 100, height: 200 } }]);
  assertEqual(sizes.length, 1, "should fire once");
  assertEqual(sizes[0].width, 100, "width");
  assertEqual(sizes[0].height, 200, "height");
});

test("onConfigure dispose disconnects ResizeObserver", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);
  resizeObserverDisconnected = false;

  const sub = ctx.onConfigure(() => {});
  sub.dispose();
  assert(resizeObserverDisconnected, "ResizeObserver should be disconnected");
});

test("onClose callback invoked on dismiss", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);
  let called = false;

  ctx.onClose(() => { called = true; });
  ctx.dismiss();
  assert(called, "onClose callback should fire on dismiss");
});

test("onClose dispose removes callback", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);
  let called = false;

  const sub = ctx.onClose(() => { called = true; });
  sub.dispose();
  ctx.dismiss();
  assert(!called, "disposed callback should not fire");
});

test("setLayer calls onLayerChange with valid layer name", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);

  ctx.setLayer("modal");
  assertEqual(opts._onLayerChangeCalls.length, 1, "onLayerChange call count");
  assertEqual(opts._onLayerChangeCalls[0], "modal", "layer name");
  assertEqual(ctx.layerName, "modal", "layerName should update");
});

test("setLayer logs warning for invalid layer", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);
  const warnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(String(args[0])); };

  ctx.setLayer("nonexistent");

  console.warn = origWarn;
  assert(warnings.length > 0, "should log a warning");
  assert(warnings[0].includes("nonexistent"), "warning should mention the layer name");
  assertEqual(opts._onLayerChangeCalls.length, 0, "onLayerChange should not be called");
});

test("setOpacity delegates to setDynamicOpacity", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);

  ctx.setOpacity(0.5);
  assertEqual((opts.element as unknown as MockElement).style.opacity, "0.5", "opacity");
});

test("setExclusiveZone calls onExclusiveZoneChange", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);

  ctx.setExclusiveZone(42);
  assertEqual(opts._onExclusiveZoneChangeCalls.length, 1, "call count");
  assertEqual(opts._onExclusiveZoneChangeCalls[0], 42, "value");
});

test("dismiss invokes onClose callbacks and onDismiss", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);
  let closeCount = 0;

  ctx.onClose(() => { closeCount++; });
  ctx.onClose(() => { closeCount++; });
  ctx.dismiss();

  assertEqual(closeCount, 2, "both onClose callbacks");
  assertEqual(opts._onDismissCalls, 1, "onDismiss called once");
});

test("dismiss cleans up ResizeObserver", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);
  resizeObserverDisconnected = false;

  ctx.onConfigure(() => {});
  ctx.dismiss();
  assert(resizeObserverDisconnected, "ResizeObserver disconnected on dismiss");
});

test("dismiss is idempotent", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);
  let closeCount = 0;
  ctx.onClose(() => { closeCount++; });

  ctx.dismiss();
  ctx.dismiss();
  assertEqual(closeCount, 1, "onClose fires only once");
  assertEqual(opts._onDismissCalls, 1, "onDismiss fires only once");
});

test("grabFocus delegates to focusGrabManager", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);

  ctx.grabFocus({ backdrop: true, dismissOnOutsideClick: true });

  assertEqual(opts._focusGrabManager.grabCalls.length, 1, "grab call count");
  const call = opts._focusGrabManager.grabCalls[0];
  assertEqual(call.surfaceId, "test-surface-1", "surfaceId");
  assertEqual(call.surfaceElement, opts.element, "element");
  assertEqual(call.layerContainer, opts.layerContainer, "container");
});

test("releaseFocus delegates to focusGrabManager", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);

  ctx.releaseFocus();
  assertEqual(opts._focusGrabManager.releaseCalls.length, 1, "release call count");
  assertEqual(opts._focusGrabManager.releaseCalls[0], "test-surface-1", "surfaceId");
});

test("getExclusiveZones reads CSS custom properties", () => {
  const opts = makeOptions();
  // Set some vars on the container
  (opts.layerContainer as unknown as MockElement)._computedVars["--layer-inset-top"] = "10";
  (opts.layerContainer as unknown as MockElement)._computedVars["--layer-inset-right"] = "20";

  const ctx = createLayerSurfaceContext(opts);
  const zones = ctx.getExclusiveZones();
  assertEqual(zones.top, 10, "top");
  assertEqual(zones.right, 20, "right");
  assertEqual(zones.bottom, 0, "bottom");
  assertEqual(zones.left, 0, "left");
});

test("context implements all required interface methods", () => {
  const opts = makeOptions();
  const ctx = createLayerSurfaceContext(opts);

  const requiredMethods = [
    "onConfigure", "onClose", "getExclusiveZones",
    "setLayer", "setOpacity", "setExclusiveZone",
    "dismiss", "grabFocus", "releaseFocus",
  ] as const;

  for (const method of requiredMethods) {
    assertEqual(typeof ctx[method], "function", `${method} should be a function`);
  }

  const requiredProps = ["surfaceId", "layerName"] as const;
  for (const prop of requiredProps) {
    assert(prop in ctx, `${prop} should exist`);
  }
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.run();
    console.log(`  ✓ ${t.name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${t.name}: ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

// Restore
(globalThis as unknown as Record<string, unknown>).getComputedStyle = originalGetComputedStyle;

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
