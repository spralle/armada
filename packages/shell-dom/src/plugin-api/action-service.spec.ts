import type { ActionSurface } from "../action-surface.js";
import type { IntentRuntime } from "../intent-runtime.js";
import type { SpecHarness } from "../context-state.spec-harness.js";
import {
  createActionService,
  type ActionServiceDependencies,
} from "./action-service.js";

function createTestSurface(): ActionSurface {
  return {
    actions: [
      {
        id: "shell.action.open",
        title: "Open File",
        intent: "shell.intent.open",
        pluginId: "shell.core",
      },
      {
        id: "shell.action.save",
        title: "Save File",
        intent: "shell.intent.save",
        pluginId: "shell.core",
        predicate: { dirty: true },
      },
      {
        id: "plugin.action.deploy",
        title: "Deploy",
        intent: "plugin.intent.deploy",
        pluginId: "plugin.deploy",
        predicate: { role: "admin" },
      },
    ],
    menus: [],
    keybindings: [
      {
        action: "shell.action.open",
        keybinding: "ctrl+o",
        pluginId: "shell.core",
      },
      {
        action: "plugin.action.deploy",
        keybinding: "ctrl+shift+d",
        pluginId: "plugin.deploy",
      },
    ],
  };
}

function createMockIntentRuntime(): IntentRuntime {
  return {
    resolveAndExecute(request) {
      return {
        executed: true,
        intent: request.intent,
        message: `Executed ${request.intent}`,
      };
    },
  };
}

function createTestDeps(
  overrides: Partial<ActionServiceDependencies> = {},
): ActionServiceDependencies {
  return {
    getActionSurface: () => createTestSurface(),
    getActionContext: () => ({}),
    getIntentRuntime: () => createMockIntentRuntime(),
    activatePlugin: async () => true,
    ...overrides,
  };
}

export function registerActionServiceSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  // ─── getActions() ───

  test("action-service: getActions returns descriptors with enabled state", async () => {
    const deps = createTestDeps({
      getActionContext: () => ({ dirty: true, role: "admin" }),
    });
    const { service } = createActionService(deps);

    const actions = await service.getActions();
    assertEqual(actions.length, 3, "should return all 3 actions");

    const openAction = actions.find((a) => a.id === "shell.action.open");
    assertTruthy(openAction, "open action should be present");
    assertEqual(openAction?.enabled, true, "action without predicate should be enabled");
    assertEqual(openAction?.disabledReason, undefined, "enabled action should have no disabled reason");

    const saveAction = actions.find((a) => a.id === "shell.action.save");
    assertTruthy(saveAction, "save action should be present");
    assertEqual(saveAction?.enabled, true, "save action with matching predicate should be enabled");
  });

  test("action-service: getActions marks disabled actions with reason", async () => {
    const deps = createTestDeps({
      getActionContext: () => ({ dirty: false }),
    });
    const { service } = createActionService(deps);

    const actions = await service.getActions();

    const saveAction = actions.find((a) => a.id === "shell.action.save");
    assertTruthy(saveAction, "save action should be present");
    assertEqual(saveAction?.enabled, false, "save action with non-matching predicate should be disabled");
    assertEqual(
      saveAction?.disabledReason,
      "Action 'Save File' is not available in current context",
      "disabled action should have reason text",
    );
  });

  test("action-service: getActions includes keybinding hints", async () => {
    const { service } = createActionService(createTestDeps());

    const actions = await service.getActions();

    const openAction = actions.find((a) => a.id === "shell.action.open");
    assertEqual(openAction?.keybinding, "ctrl+o", "open action should have keybinding hint");

    const deployAction = actions.find((a) => a.id === "plugin.action.deploy");
    assertEqual(deployAction?.keybinding, "ctrl+shift+d", "deploy action should have keybinding hint");

    const saveAction = actions.find((a) => a.id === "shell.action.save");
    assertEqual(saveAction?.keybinding, undefined, "save action without keybinding should be undefined");
  });

  test("action-service: getActions preserves pluginId", async () => {
    const { service } = createActionService(createTestDeps());

    const actions = await service.getActions();

    const openAction = actions.find((a) => a.id === "shell.action.open");
    assertEqual(openAction?.pluginId, "shell.core", "open action should preserve pluginId");

    const deployAction = actions.find((a) => a.id === "plugin.action.deploy");
    assertEqual(deployAction?.pluginId, "plugin.deploy", "deploy action should preserve pluginId");
  });

  // ─── registerAction() ───

  test("action-service: registerAction fires onDidChangeActions", () => {
    const { service } = createActionService(createTestDeps());

    let fired = 0;
    service.onDidChangeActions(() => {
      fired += 1;
    });

    service.registerAction("custom.action", () => "result");
    assertEqual(fired, 1, "onDidChangeActions should fire once on register");
  });

  test("action-service: registerAction disposable removes action and fires event", () => {
    const { service } = createActionService(createTestDeps());

    let fired = 0;
    service.onDidChangeActions(() => {
      fired += 1;
    });

    const disposable = service.registerAction("custom.action", () => "result");
    assertEqual(fired, 1, "should fire on register");

    disposable.dispose();
    assertEqual(fired, 2, "should fire again on dispose");
  });

  // ─── executeAction() ───

  test("action-service: executeAction calls activation then dispatch", async () => {
    let activatedPluginId = "";
    let activatedTriggerId = "";

    const deps = createTestDeps({
      activatePlugin: async (pluginId, triggerId) => {
        activatedPluginId = pluginId;
        activatedTriggerId = triggerId;
        return true;
      },
    });
    const { service } = createActionService(deps);

    await service.executeAction("shell.action.open");

    assertEqual(activatedPluginId, "shell.core", "should activate the correct plugin");
    assertEqual(activatedTriggerId, "shell.action.open", "should pass the action ID as trigger");
  });

  test("action-service: executeAction throws when action not found", async () => {
    const { service } = createActionService(createTestDeps());

    let threw = false;
    try {
      await service.executeAction("nonexistent.action");
    } catch (error) {
      threw = true;
      assertTruthy(
        error instanceof Error && error.message.includes("nonexistent.action"),
        "error should mention the missing action ID",
      );
    }

    assertEqual(threw, true, "should throw for nonexistent action");
  });

  test("action-service: executeAction throws when plugin activation fails", async () => {
    const deps = createTestDeps({
      activatePlugin: async () => false,
    });
    const { service } = createActionService(deps);

    let threw = false;
    try {
      await service.executeAction("shell.action.open");
    } catch (error) {
      threw = true;
      assertTruthy(
        error instanceof Error && error.message.includes("blocked"),
        "error should mention activation blocked",
      );
    }

    assertEqual(threw, true, "should throw when plugin cannot be activated");
  });

  test("action-service: executeAction executes runtime-registered actions directly", async () => {
    const { service } = createActionService(createTestDeps());

    let handlerCalled = false;
    service.registerAction("runtime.action", () => {
      handlerCalled = true;
      return "runtime-result";
    });

    await service.executeAction("runtime.action");
    assertEqual(handlerCalled, true, "runtime handler should be called");
  });

  // ─── fireChanged() ───

  test("action-service: fireChanged notifies onDidChangeActions listeners", () => {
    const result = createActionService(createTestDeps());

    let fired = 0;
    result.service.onDidChangeActions(() => {
      fired += 1;
    });

    result.fireChanged();
    assertEqual(fired, 1, "fireChanged should notify listeners");

    result.fireChanged();
    assertEqual(fired, 2, "fireChanged should notify on each call");
  });

  test("action-service: dispose clears all listeners", () => {
    const result = createActionService(createTestDeps());

    let fired = 0;
    result.service.onDidChangeActions(() => {
      fired += 1;
    });

    result.fireChanged();
    assertEqual(fired, 1, "should fire before dispose");

    result.dispose();
    result.fireChanged();
    assertEqual(fired, 1, "should not fire after dispose");
  });
}
