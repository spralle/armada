import { createDefaultContributionPredicateMatcher } from "@ghost-shell/plugin-contracts";
import type { ActionSurface } from "../action-surface.js";
import type { SpecHarness } from "../context-state.spec-harness.js";
import type { IntentRuntime } from "../intent-runtime.js";
import { createKeybindingService } from "./keybinding-service.js";

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
        predicate: {
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
    resolveAndExecute(request) {
      calls.push({
        intent: request.intent,
        context: request.context,
      });

      return {
        executed: request.intent !== "shell.intent.hidden",
        intent: request.intent,
        message: "ok",
      };
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
}
