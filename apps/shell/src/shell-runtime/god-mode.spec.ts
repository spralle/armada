import type { SpecHarness } from "../context-state.spec-harness.js";
import {
  createGodModeInterceptor,
  validateGodModeAuth,
  activateElevatedSession,
} from "./god-mode.js";
import type { ShellRuntime } from "../app/types.js";
import { buildActionSurface } from "../action-surface.js";
import { createDefaultShellKeybindingContract } from "./default-shell-keybindings.js";

function createMinimalRuntime(): ShellRuntime {
  return {
    elevatedSession: { active: false, activatedAt: null },
    notice: "",
    commandNotice: "",
    actionSurface: buildActionSurface([createDefaultShellKeybindingContract()]),
  } as unknown as ShellRuntime;
}

function syntheticEvent(overrides: {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}): KeyboardEvent {
  return {
    key: overrides.key,
    ctrlKey: overrides.ctrlKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    altKey: overrides.altKey ?? false,
    metaKey: false,
    preventDefault() {},
  } as unknown as KeyboardEvent;
}

export function registerGodModeSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("god-mode: sequence triggers — each chord consumed", () => {
    const runtime = createMinimalRuntime();
    const interceptor = createGodModeInterceptor(runtime);

    const r1 = interceptor(syntheticEvent({ key: "g", ctrlKey: true, shiftKey: true, altKey: true }));
    assertEqual(r1, true, "first chord (ctrl+shift+alt+g) should be consumed");

    const r2 = interceptor(syntheticEvent({ key: "o" }));
    assertEqual(r2, true, "second chord (o) should be consumed");

    const r3 = interceptor(syntheticEvent({ key: "d" }));
    assertEqual(r3, true, "third chord (d) should be consumed");
  });

  test("god-mode: not exposed in action list", () => {
    const runtime = createMinimalRuntime();
    const actions = runtime.actionSurface.actions;
    const godModeAction = actions.find(
      (a: { id: string }) => a.id.toLowerCase().includes("god") || a.id.toLowerCase().includes("elevated"),
    );
    assertEqual(godModeAction, undefined, "god-mode should not appear in action surface");
  });

  test("god-mode: partial sequence consumed, unrelated key resets", () => {
    const runtime = createMinimalRuntime();
    const interceptor = createGodModeInterceptor(runtime);

    const r1 = interceptor(syntheticEvent({ key: "g", ctrlKey: true, shiftKey: true, altKey: true }));
    assertEqual(r1, true, "first chord should be consumed");

    const r2 = interceptor(syntheticEvent({ key: "x" }));
    assertEqual(r2, false, "unrelated key should not be consumed and should reset");

    // After reset, 'o' alone should not be consumed
    const r3 = interceptor(syntheticEvent({ key: "o" }));
    assertEqual(r3, false, "o after reset should not be consumed");
  });

  test("god-mode: validateGodModeAuth accepts correct secret", () => {
    assertEqual(validateGodModeAuth("armada"), true, "correct secret should validate");
  });

  test("god-mode: validateGodModeAuth rejects wrong secret", () => {
    assertEqual(validateGodModeAuth("wrong"), false, "wrong secret should not validate");
  });

  test("god-mode: activateElevatedSession sets runtime state", () => {
    const runtime = createMinimalRuntime();
    activateElevatedSession(runtime);
    assertEqual(runtime.elevatedSession.active, true, "session should be active");
    assertTruthy(runtime.elevatedSession.activatedAt !== null, "activatedAt should be set");
    assertTruthy(runtime.notice.length > 0, "notice should be set");
  });

  test("god-mode: first chord must be ctrl+shift+alt+g", () => {
    const runtime = createMinimalRuntime();
    const interceptor = createGodModeInterceptor(runtime);

    const r1 = interceptor(syntheticEvent({ key: "o" }));
    assertEqual(r1, false, "o without prior ctrl+shift+alt+g should not be consumed");
  });

  test("god-mode: sequence resets after full completion", () => {
    const runtime = createMinimalRuntime();
    const interceptor = createGodModeInterceptor(runtime);

    // Complete the sequence
    interceptor(syntheticEvent({ key: "g", ctrlKey: true, shiftKey: true, altKey: true }));
    interceptor(syntheticEvent({ key: "o" }));
    interceptor(syntheticEvent({ key: "d" }));

    // After completion, a new ctrl+shift+alt+g should start fresh
    const r = interceptor(syntheticEvent({ key: "g", ctrlKey: true, shiftKey: true, altKey: true }));
    assertEqual(r, true, "should start new sequence after completion");
  });
}
