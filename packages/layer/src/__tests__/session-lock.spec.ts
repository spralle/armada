import type { KeyboardExclusiveManager } from "../input-behavior.js";
import { createSessionLockManager } from "../session-lock.js";

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
// Minimal DOM mocks
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
  dataset: Record<string, string | undefined>;
  className: string;
  tagName: string;
  focused: boolean;
  focus(): void;
  blur(): void;
}

function makeMockElement(tagName: string, className: string, layer: string, z: string): MockElement {
  return {
    style: makeStyleProxy(),
    dataset: { layer, z },
    className,
    tagName,
    focused: false,
    focus() {
      this.focused = true;
    },
    blur() {
      this.focused = false;
    },
  };
}

function makeMockDiv(): MockElement {
  return {
    style: makeStyleProxy(),
    dataset: {},
    className: "",
    tagName: "DIV",
    focused: false,
    focus() {
      this.focused = true;
    },
    blur() {
      this.focused = false;
    },
  };
}

/** Build a mock layerHost with standard shell-layer sections. */
function buildLayerHost(): {
  layerHost: MockElement & { _sections: MockElement[]; querySelectorAll: (sel: string) => MockElement[] };
  sections: Record<string, MockElement>;
} {
  const background = makeMockElement("SECTION", "shell-layer", "background", "0");
  const bottom = makeMockElement("SECTION", "shell-layer", "bottom", "100");
  const main = makeMockElement("MAIN", "shell shell-layer", "main", "200");
  const floating = makeMockElement("SECTION", "shell-layer", "floating", "300");
  const notification = makeMockElement("SECTION", "shell-layer", "notification", "400");
  const modal = makeMockElement("SECTION", "shell-layer", "modal", "500");
  const overlay = makeMockElement("SECTION", "shell-layer", "overlay", "600");

  const allSections = [background, bottom, main, floating, notification, modal, overlay];

  const layerHost = {
    ...makeMockDiv(),
    _sections: allSections,
    querySelectorAll(_sel: string): MockElement[] {
      return allSections;
    },
  };

  return {
    layerHost,
    sections: { background, bottom, main, floating, notification, modal, overlay },
  };
}

function makeMockKeyboardManager(): KeyboardExclusiveManager & {
  pushCalls: Array<{ surfaceId: string }>;
  popCalls: string[];
} {
  const pushCalls: Array<{ surfaceId: string }> = [];
  const popCalls: string[] = [];
  return {
    pushCalls,
    popCalls,
    pushExclusive(surfaceId: string, _element: HTMLDivElement) {
      pushCalls.push({ surfaceId });
    },
    popExclusive(surfaceId: string) {
      popCalls.push(surfaceId);
    },
    getActiveExclusive() {
      return null;
    },
    dispose() {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("activateLock hides main layer with display:none", () => {
  const { layerHost, sections } = buildLayerHost();
  const kbd = makeMockKeyboardManager();
  const mgr = createSessionLockManager({
    layerHost: layerHost as unknown as HTMLElement,
    keyboardExclusiveManager: kbd,
  });
  const surface = makeMockDiv();
  const container = makeMockDiv();

  mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);

  assertEqual(sections.main.style.display, "none", "main layer should be display:none");
});

test("activateLock sets visibility:hidden on layers below overlay", () => {
  const { layerHost, sections } = buildLayerHost();
  const kbd = makeMockKeyboardManager();
  const mgr = createSessionLockManager({
    layerHost: layerHost as unknown as HTMLElement,
    keyboardExclusiveManager: kbd,
  });
  const surface = makeMockDiv();
  const container = makeMockDiv();

  mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);

  assertEqual(sections.background.style.visibility, "hidden", "background should be visibility:hidden");
  assertEqual(sections.background.style.pointerEvents, "none", "background should be pointer-events:none");
  assertEqual(sections.bottom.style.visibility, "hidden", "bottom should be visibility:hidden");
  assertEqual(sections.floating.style.visibility, "hidden", "floating should be visibility:hidden");
  assertEqual(sections.notification.style.visibility, "hidden", "notification should be visibility:hidden");
  assertEqual(sections.modal.style.visibility, "hidden", "modal should be visibility:hidden");
  // Overlay should NOT be hidden
  assertEqual(sections.overlay.style.visibility, "", "overlay should remain visible");
  assertEqual(sections.overlay.style.pointerEvents, "", "overlay should keep pointer-events");
});

test("activateLock pushes keyboard exclusive", () => {
  const { layerHost } = buildLayerHost();
  const kbd = makeMockKeyboardManager();
  const mgr = createSessionLockManager({
    layerHost: layerHost as unknown as HTMLElement,
    keyboardExclusiveManager: kbd,
  });
  const surface = makeMockDiv();
  const container = makeMockDiv();

  mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);

  assertEqual(kbd.pushCalls.length, 1, "should push exclusive once");
  assertEqual(kbd.pushCalls[0].surfaceId, "lock-1", "should push correct surfaceId");
});

test("canAddSurface returns false for z > 600 when locked", () => {
  const { layerHost } = buildLayerHost();
  const kbd = makeMockKeyboardManager();
  const mgr = createSessionLockManager({
    layerHost: layerHost as unknown as HTMLElement,
    keyboardExclusiveManager: kbd,
  });
  const surface = makeMockDiv();
  const container = makeMockDiv();

  mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);

  assertEqual(mgr.canAddSurface(700), false, "z=700 should be blocked when locked");
  assertEqual(mgr.canAddSurface(601), false, "z=601 should be blocked when locked");
});

test("canAddSurface returns true for z <= 600 when locked", () => {
  const { layerHost } = buildLayerHost();
  const kbd = makeMockKeyboardManager();
  const mgr = createSessionLockManager({
    layerHost: layerHost as unknown as HTMLElement,
    keyboardExclusiveManager: kbd,
  });
  const surface = makeMockDiv();
  const container = makeMockDiv();

  mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);

  assertEqual(mgr.canAddSurface(600), true, "z=600 should be allowed when locked");
  assertEqual(mgr.canAddSurface(100), true, "z=100 should be allowed when locked");
  assertEqual(mgr.canAddSurface(0), true, "z=0 should be allowed when locked");
});

test("canAddSurface returns true for any z when not locked", () => {
  const { layerHost } = buildLayerHost();
  const kbd = makeMockKeyboardManager();
  const mgr = createSessionLockManager({
    layerHost: layerHost as unknown as HTMLElement,
    keyboardExclusiveManager: kbd,
  });

  assertEqual(mgr.canAddSurface(700), true, "z=700 should be allowed when unlocked");
  assertEqual(mgr.canAddSurface(600), true, "z=600 should be allowed when unlocked");
  assertEqual(mgr.canAddSurface(0), true, "z=0 should be allowed when unlocked");
});

test("releaseLock restores main layer display", () => {
  const { layerHost, sections } = buildLayerHost();
  const kbd = makeMockKeyboardManager();
  const mgr = createSessionLockManager({
    layerHost: layerHost as unknown as HTMLElement,
    keyboardExclusiveManager: kbd,
  });
  const surface = makeMockDiv();
  const container = makeMockDiv();

  mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);
  mgr.releaseLock("lock-1");

  assertEqual(sections.main.style.display, "", "main layer display should be restored");
});

test("releaseLock restores visibility on all layers", () => {
  const { layerHost, sections } = buildLayerHost();
  const kbd = makeMockKeyboardManager();
  const mgr = createSessionLockManager({
    layerHost: layerHost as unknown as HTMLElement,
    keyboardExclusiveManager: kbd,
  });
  const surface = makeMockDiv();
  const container = makeMockDiv();

  mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);
  mgr.releaseLock("lock-1");

  assertEqual(sections.background.style.visibility, "", "background visibility should be restored");
  assertEqual(sections.background.style.pointerEvents, "", "background pointer-events should be restored");
  assertEqual(sections.bottom.style.visibility, "", "bottom visibility should be restored");
  assertEqual(sections.floating.style.visibility, "", "floating visibility should be restored");
  assertEqual(sections.notification.style.visibility, "", "notification visibility should be restored");
  assertEqual(sections.modal.style.visibility, "", "modal visibility should be restored");
});

test("releaseLock pops keyboard exclusive", () => {
  const { layerHost } = buildLayerHost();
  const kbd = makeMockKeyboardManager();
  const mgr = createSessionLockManager({
    layerHost: layerHost as unknown as HTMLElement,
    keyboardExclusiveManager: kbd,
  });
  const surface = makeMockDiv();
  const container = makeMockDiv();

  mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);
  mgr.releaseLock("lock-1");

  assertEqual(kbd.popCalls.length, 1, "should pop exclusive once");
  assertEqual(kbd.popCalls[0], "lock-1", "should pop correct surfaceId");
});

test("only the correct surface ID can release the lock", () => {
  const { layerHost, sections } = buildLayerHost();
  const kbd = makeMockKeyboardManager();
  const mgr = createSessionLockManager({
    layerHost: layerHost as unknown as HTMLElement,
    keyboardExclusiveManager: kbd,
  });
  const surface = makeMockDiv();
  const container = makeMockDiv();

  mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);
  mgr.releaseLock("wrong-surface");

  // Lock should still be active
  assertEqual(mgr.isLocked(), true, "lock should still be active");
  assertEqual(sections.main.style.display, "none", "main should still be hidden");
  assertEqual(kbd.popCalls.length, 0, "should not pop exclusive for wrong surface");
});

test("isLocked returns correct state", () => {
  const { layerHost } = buildLayerHost();
  const kbd = makeMockKeyboardManager();
  const mgr = createSessionLockManager({
    layerHost: layerHost as unknown as HTMLElement,
    keyboardExclusiveManager: kbd,
  });
  const surface = makeMockDiv();
  const container = makeMockDiv();

  assertEqual(mgr.isLocked(), false, "should not be locked initially");
  mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);
  assertEqual(mgr.isLocked(), true, "should be locked after activate");
  mgr.releaseLock("lock-1");
  assertEqual(mgr.isLocked(), false, "should not be locked after release");
});

test("getActiveLockSurfaceId returns correct value", () => {
  const { layerHost } = buildLayerHost();
  const kbd = makeMockKeyboardManager();
  const mgr = createSessionLockManager({
    layerHost: layerHost as unknown as HTMLElement,
    keyboardExclusiveManager: kbd,
  });
  const surface = makeMockDiv();
  const container = makeMockDiv();

  assertEqual(mgr.getActiveLockSurfaceId(), null, "should be null when unlocked");
  mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);
  assertEqual(mgr.getActiveLockSurfaceId(), "lock-1", "should return lock surface id");
  mgr.releaseLock("lock-1");
  assertEqual(mgr.getActiveLockSurfaceId(), null, "should be null after release");
});

test("activateLock is idempotent when already locked", () => {
  const { layerHost } = buildLayerHost();
  const kbd = makeMockKeyboardManager();
  const mgr = createSessionLockManager({
    layerHost: layerHost as unknown as HTMLElement,
    keyboardExclusiveManager: kbd,
  });
  const surface1 = makeMockDiv();
  const surface2 = makeMockDiv();
  const container = makeMockDiv();

  mgr.activateLock("lock-1", surface1 as unknown as HTMLDivElement, container as unknown as HTMLElement);
  mgr.activateLock("lock-2", surface2 as unknown as HTMLDivElement, container as unknown as HTMLElement);

  assertEqual(mgr.getActiveLockSurfaceId(), "lock-1", "first lock should remain active");
  assertEqual(kbd.pushCalls.length, 1, "should only push exclusive once");
});

// ---------------------------------------------------------------------------
// Runner
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
