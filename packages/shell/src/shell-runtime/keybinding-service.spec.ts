import { createDefaultContributionPredicateMatcher } from "@ghost-shell/plugin-system";
import type { ActionSurface } from "../action-surface.js";
import type { SpecHarness } from "../context-state.spec-harness.js";
import type { IntentRuntime } from "@ghost-shell/intents";
import { createKeybindingService } from "@ghost-shell/commands";

function createActionSurface(): ActionSurface {
  return {
    actions: [
      {
        id: "shell.action.default",
        title: "Default Action",
        intent: "shell.intent.default",
        pluginId: "shell.defaults",
      },
      {
        id: "shell.action.plugin",
        title: "Plugin Action",
        intent: "shell.intent.plugin",
        pluginId: "plugin.a",
      },
      {
        id: "shell.action.hidden",
        title: "Hidden Action",
        intent: "shell.intent.hidden",
        pluginId: "plugin.b",
        when: {
          mode: "enabled",
        },
      },
    ],
    menus: [],
    keybindings: [
      {
        action: "shell.action.plugin",
        keybinding: "shift+ctrl+p",
        pluginId: "plugin.a",
      },
      {
        action: "shell.action.hidden",
        keybinding: "ctrl+h",
        pluginId: "plugin.b",
        when: {
          role: "admin",
        },
      },
    ],
  };
}

function createIntentRuntime(calls: { intent: string; context: Readonly<Record<string, string>> }[]): IntentRuntime {
  return {
    async resolve(intent, _delegate, _options) {
      calls.push({
        intent: intent.type,
        context: intent.facts as Readonly<Record<string, string>>,
      });

      const trace = { intentType: intent.type, evaluatedAt: 0, actions: [], matched: [] };
      if (intent.type === "shell.intent.hidden") {
        return { kind: "no-match", feedback: "no match", trace };
      }
      return { kind: "executed", match: { pluginId: "stub", pluginName: "Stub", actionId: "stub", title: "Stub", handler: "stub", intentType: intent.type, when: {}, loadStrategy: "eager", registrationOrder: 0, sortKey: "stub" }, trace };
    },
  };
}

export function registerKeybindingServiceSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("normalizer canonicalizes keyboard events and configured chords", () => {
    const service = createKeybindingService({
      actionSurface: createActionSurface(),
      intentRuntime: createIntentRuntime([]),
    });

    const fromEvent = service.normalizeEvent({
      key: "P",
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    } as KeyboardEvent);

    assertTruthy(fromEvent, "normalizer should emit chord for non-modifier key event");
    assertEqual(fromEvent?.value, "ctrl+shift+p", "event normalizer should enforce canonical modifier order");

    const resolution = service.resolve({
      modifiers: ["ctrl", "shift"],
      key: "p",
      value: "ctrl+shift+p",
    }, {});
    assertEqual(resolution.match?.action.id, "shell.action.plugin", "configured chord should resolve against canonical key");
  });

  test("layer precedence resolves user overrides ahead of plugins and defaults", async () => {
    const calls: { intent: string; context: Readonly<Record<string, string>> }[] = [];
    const service = createKeybindingService({
      actionSurface: createActionSurface(),
      intentRuntime: createIntentRuntime(calls),
      defaultBindings: [
        {
          action: "shell.action.default",
          keybinding: "ctrl+o",
          pluginId: "shell.defaults",
        },
      ],
      userOverrideBindings: [
        {
          action: "shell.action.plugin",
          keybinding: "ctrl+o",
          pluginId: "user.override",
        },
      ],
    });

    const result = service.resolve({
      modifiers: ["ctrl"],
      key: "o",
      value: "ctrl+o",
    }, {});
    assertEqual(result.match?.action.id, "shell.action.plugin", "user override should take precedence for duplicate chord");
    assertEqual(result.match?.source.layer, "user-overrides", "resolved metadata should identify winning layer");

    await service.dispatch({
      modifiers: ["ctrl"],
      key: "o",
      value: "ctrl+o",
    }, {
      tabId: "tab-a",
    });
    assertEqual(calls.length, 1, "dispatch should execute resolved action exactly once");
    assertEqual(calls[0]?.intent, "shell.intent.plugin", "dispatch should route to selected action intent");
  });

  test("resolver respects predicates and reports non-executable dispatch", async () => {
    const calls: { intent: string; context: Readonly<Record<string, string>> }[] = [];
    const service = createKeybindingService({
      actionSurface: createActionSurface(),
      intentRuntime: createIntentRuntime(calls),
      matcher: createDefaultContributionPredicateMatcher(),
    });

    const denied = service.resolve({
      modifiers: ["ctrl"],
      key: "h",
      value: "ctrl+h",
    }, {
      role: "operator",
      mode: "enabled",
    });
    assertEqual(denied.match, null, "resolver should skip bindings when predicates do not match");

    const allowed = await service.dispatch({
      modifiers: ["ctrl"],
      key: "h",
      value: "ctrl+h",
    }, {
      role: "admin",
      mode: "enabled",
    });
    assertEqual(allowed.resolution.match?.action.id, "shell.action.hidden", "resolver should return predicate-valid action");
    assertEqual(allowed.executed, false, "dispatch should surface non-executable result from intent runtime");
    assertEqual(calls.length, 1, "dispatch should attempt execution for allowed binding");
  });

  test("resolveSequence with single chord works like legacy resolve", () => {
    const service = createKeybindingService({
      actionSurface: createActionSurface(),
      intentRuntime: createIntentRuntime([]),
    });

    const result = service.resolveSequence([{
      modifiers: ["ctrl", "shift"],
      key: "p",
      value: "ctrl+shift+p",
    }], {});

    assertEqual(result.kind, "exact", "single-chord sequence should resolve as exact match");
    assertEqual(result.match?.action.id, "shell.action.plugin", "single-chord sequence should find the right action");
    assertEqual(result.chords.length, 1, "result should contain the input chords");
  });

  test("resolveSequence with multi-chord sequence returns exact match", () => {
    const surface: ActionSurface = {
      actions: [
        {
          id: "shell.action.multi",
          title: "Multi Action",
          intent: "shell.intent.multi",
          pluginId: "shell.defaults",
        },
      ],
      menus: [],
      keybindings: [
        {
          action: "shell.action.multi",
          keybinding: "ctrl+k ctrl+c",
          pluginId: "shell.defaults",
        },
      ],
    };

    const service = createKeybindingService({
      actionSurface: surface,
      intentRuntime: createIntentRuntime([]),
    });

    const result = service.resolveSequence([
      { modifiers: ["ctrl"], key: "k", value: "ctrl+k" },
      { modifiers: ["ctrl"], key: "c", value: "ctrl+c" },
    ], {});

    assertEqual(result.kind, "exact", "full multi-chord sequence should resolve as exact");
    assertEqual(result.match?.action.id, "shell.action.multi", "multi-chord sequence should find the right action");
  });

  test("resolveSequence with partial sequence returns prefix", () => {
    const surface: ActionSurface = {
      actions: [
        {
          id: "shell.action.multi",
          title: "Multi Action",
          intent: "shell.intent.multi",
          pluginId: "shell.defaults",
        },
      ],
      menus: [],
      keybindings: [
        {
          action: "shell.action.multi",
          keybinding: "ctrl+k ctrl+c",
          pluginId: "shell.defaults",
        },
      ],
    };

    const service = createKeybindingService({
      actionSurface: surface,
      intentRuntime: createIntentRuntime([]),
    });

    const result = service.resolveSequence([
      { modifiers: ["ctrl"], key: "k", value: "ctrl+k" },
    ], {});

    assertEqual(result.kind, "prefix", "partial sequence should return prefix");
    assertTruthy((result.prefixCount ?? 0) > 0, "prefix result should report candidate count");
  });

  test("hasPrefix returns true for valid prefix, false for non-prefix", () => {
    const surface: ActionSurface = {
      actions: [
        {
          id: "shell.action.multi",
          title: "Multi Action",
          intent: "shell.intent.multi",
          pluginId: "shell.defaults",
        },
      ],
      menus: [],
      keybindings: [
        {
          action: "shell.action.multi",
          keybinding: "ctrl+k ctrl+c",
          pluginId: "shell.defaults",
        },
      ],
    };

    const service = createKeybindingService({
      actionSurface: surface,
      intentRuntime: createIntentRuntime([]),
    });

    const hasValid = service.hasPrefix([
      { modifiers: ["ctrl"], key: "k", value: "ctrl+k" },
    ], {});
    assertEqual(hasValid, true, "should detect valid prefix");

    const hasInvalid = service.hasPrefix([
      { modifiers: ["ctrl"], key: "z", value: "ctrl+z" },
    ], {});
    assertEqual(hasInvalid, false, "should reject non-matching prefix");
  });

  test("dispatchSequence only dispatches on exact match", async () => {
    const calls: { intent: string; context: Readonly<Record<string, string>> }[] = [];
    const surface: ActionSurface = {
      actions: [
        {
          id: "shell.action.multi",
          title: "Multi Action",
          intent: "shell.intent.multi",
          pluginId: "shell.defaults",
        },
      ],
      menus: [],
      keybindings: [
        {
          action: "shell.action.multi",
          keybinding: "ctrl+k ctrl+c",
          pluginId: "shell.defaults",
        },
      ],
    };

    const service = createKeybindingService({
      actionSurface: surface,
      intentRuntime: createIntentRuntime(calls),
    });

    // Partial sequence should not dispatch
    const partial = await service.dispatchSequence([
      { modifiers: ["ctrl"], key: "k", value: "ctrl+k" },
    ], {});
    assertEqual(partial.executed, false, "partial sequence should not dispatch");
    assertEqual(calls.length, 0, "no intent should be invoked for partial sequence");

    // Full sequence should dispatch
    const full = await service.dispatchSequence([
      { modifiers: ["ctrl"], key: "k", value: "ctrl+k" },
      { modifiers: ["ctrl"], key: "c", value: "ctrl+c" },
    ], {});
    assertEqual(full.resolution.match?.action.id, "shell.action.multi", "full sequence should resolve action");
    assertEqual(full.executed, true, "full sequence should dispatch successfully");
    assertEqual(calls.length, 1, "intent should be invoked once for full sequence");
  });

  test("service exposes sequence lifecycle event emitters", () => {
    const service = createKeybindingService({
      actionSurface: createActionSurface(),
      intentRuntime: createIntentRuntime([]),
    });

    // onDidKeySequencePending
    const pendingEvents: Array<{ pressedChords: string[]; candidateCount: number }> = [];
    const sub1 = service.onDidKeySequencePending((e: { pressedChords: string[]; candidateCount: number }) => pendingEvents.push(e));
    service.fireKeySequencePending({ pressedChords: ["ctrl+k"], candidateCount: 3 });
    assertEqual(pendingEvents.length, 1, "pending event should fire once");
    assertEqual(pendingEvents[0]?.pressedChords[0], "ctrl+k", "pending event should carry pressed chords");
    assertEqual(pendingEvents[0]?.candidateCount, 3, "pending event should carry candidate count");
    sub1.dispose();

    // onDidKeySequenceCompleted
    const completedEvents: Array<{ chords: string[]; actionId: string }> = [];
    const sub2 = service.onDidKeySequenceCompleted((e: { chords: string[]; actionId: string }) => completedEvents.push(e));
    service.fireKeySequenceCompleted({ chords: ["ctrl+k", "ctrl+c"], actionId: "test.action" });
    assertEqual(completedEvents.length, 1, "completed event should fire once");
    assertEqual(completedEvents[0]?.actionId, "test.action", "completed event should carry action id");
    sub2.dispose();

    // onDidKeySequenceCancelled
    const cancelledEvents: Array<{ chords: string[]; reason: string }> = [];
    const sub3 = service.onDidKeySequenceCancelled((e: { chords: string[]; reason: string }) => cancelledEvents.push(e));
    service.fireKeySequenceCancelled({ chords: ["ctrl+k"], reason: "timeout" });
    assertEqual(cancelledEvents.length, 1, "cancelled event should fire once");
    assertEqual(cancelledEvents[0]?.reason, "timeout", "cancelled event should carry reason");
    sub3.dispose();

    // After dispose, events should not fire
    service.fireKeySequencePending({ pressedChords: ["ctrl+x"], candidateCount: 1 });
    assertEqual(pendingEvents.length, 1, "disposed subscription should not receive events");
  });
}
