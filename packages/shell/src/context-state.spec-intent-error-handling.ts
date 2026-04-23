import {
  createIntentRuntime,
  type IntentResolutionDelegate,
  type IntentActionMatch,
  type ShellIntent,
  type IntentResolutionTrace,
} from "@ghost-shell/intents";
import { createContract } from "./context-state.spec-intent-runtime-fixtures.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

function createMockDelegate(overrides: Partial<IntentResolutionDelegate> = {}): IntentResolutionDelegate & {
  calls: { activatePlugin: { pluginId: string; trigger: { type: string; id: string } }[]; announce: string[]; showChooser: number };
} {
  const calls = {
    activatePlugin: [] as { pluginId: string; trigger: { type: string; id: string } }[],
    announce: [] as string[],
    showChooser: 0,
  };
  return {
    calls,
    async showChooser(matches, intent, trace) {
      calls.showChooser++;
      if (overrides.showChooser) return overrides.showChooser(matches, intent, trace);
      return matches[0] ?? null;
    },
    async activatePlugin(pluginId, trigger) {
      calls.activatePlugin.push({ pluginId, trigger });
      if (overrides.activatePlugin) return overrides.activatePlugin(pluginId, trigger);
      return true;
    },
    announce(message) {
      calls.announce.push(message);
      if (overrides.announce) overrides.announce(message);
    },
  };
}

function createSingleMatchPlugin() {
  return [
    {
      id: "plugin-single",
      enabled: true,
      loadStrategy: "local-source",
      contract: createContract({
        manifest: { id: "plugin-single", name: "Single", version: "0.1.0" },
        contributes: {
          actions: [
            { id: "single.action", title: "Single Action", intent: "error.test.action", when: { scope: "test" } },
          ],
        },
      }),
    },
  ];
}

function createMultiMatchPlugins() {
  return [
    {
      id: "plugin-err-a",
      enabled: true,
      loadStrategy: "local-source",
      contract: createContract({
        manifest: { id: "plugin-err-a", name: "Err A", version: "0.1.0" },
        contributes: {
          actions: [
            { id: "err-a.action", title: "Err A Action", intent: "error.multi.action", when: { scope: "shared" } },
          ],
        },
      }),
    },
    {
      id: "plugin-err-b",
      enabled: true,
      loadStrategy: "local-source",
      contract: createContract({
        manifest: { id: "plugin-err-b", name: "Err B", version: "0.1.0" },
        contributes: {
          actions: [
            { id: "err-b.action", title: "Err B Action", intent: "error.multi.action", when: { scope: "shared" } },
          ],
        },
      }),
    },
  ];
}

function createSnapshotDeps(plugins: ReturnType<typeof createSingleMatchPlugin> | ReturnType<typeof createMultiMatchPlugins>) {
  return { getRegistrySnapshot: () => ({ plugins }) };
}

export function registerIntentErrorHandlingSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  // Scenario 1: activatePlugin returns false → failure reported
  test("error handling: activatePlugin returning false yields no-match with failure feedback", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(createSingleMatchPlugin()));
    const delegate = createMockDelegate({
      async activatePlugin() {
        return false;
      },
    });
    const intent: ShellIntent = { type: "error.test.action", facts: { scope: "test" } };

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "no-match", "activation failure yields no-match");
    if (outcome.kind === "no-match") {
      assertEqual(outcome.feedback, "Plugin activation failed.", "failure feedback message");
    }
  });

  // Scenario 2: activatePlugin throws → error propagates
  test("error handling: activatePlugin throwing propagates error", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(createSingleMatchPlugin()));
    const delegate = createMockDelegate({
      async activatePlugin() {
        throw new Error("activation explosion");
      },
    });
    const intent: ShellIntent = { type: "error.test.action", facts: { scope: "test" } };

    let caughtError: Error | null = null;
    try {
      await runtime.resolve(intent, delegate);
    } catch (err) {
      caughtError = err as Error;
    }

    assertTruthy(caughtError !== null, "error is propagated from activatePlugin");
    assertEqual(caughtError?.message, "activation explosion", "original error message preserved");
  });

  // Scenario 3: showChooser throws → error propagates
  test("error handling: showChooser throwing propagates error", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(createMultiMatchPlugins()));
    const delegate = createMockDelegate({
      async showChooser() {
        throw new Error("chooser explosion");
      },
    });
    const intent: ShellIntent = { type: "error.multi.action", facts: { scope: "shared" } };

    let caughtError: Error | null = null;
    try {
      await runtime.resolve(intent, delegate);
    } catch (err) {
      caughtError = err as Error;
    }

    assertTruthy(caughtError !== null, "error is propagated from showChooser");
    assertEqual(caughtError?.message, "chooser explosion", "original error message preserved");
  });

  // Scenario 4: showChooser returns rejected promise → handled
  test("error handling: showChooser rejected promise propagates error", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(createMultiMatchPlugins()));
    const delegate = createMockDelegate({
      showChooser() {
        return Promise.reject(new Error("chooser rejected"));
      },
    });
    const intent: ShellIntent = { type: "error.multi.action", facts: { scope: "shared" } };

    let caughtError: Error | null = null;
    try {
      await runtime.resolve(intent, delegate);
    } catch (err) {
      caughtError = err as Error;
    }

    assertTruthy(caughtError !== null, "rejected promise propagates");
    assertEqual(caughtError?.message, "chooser rejected", "rejection error message preserved");
  });

  // Scenario 5: Plugin with no runtime handler — activatePlugin still called
  test("error handling: plugin with matching contract still triggers activatePlugin", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(createSingleMatchPlugin()));
    const delegate = createMockDelegate();
    const intent: ShellIntent = { type: "error.test.action", facts: { scope: "test" } };

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "executed", "resolution succeeds");
    assertEqual(delegate.calls.activatePlugin.length, 1, "activatePlugin called regardless of runtime handler");
    assertEqual(delegate.calls.activatePlugin[0].pluginId, "plugin-single", "correct plugin id passed");
  });
}
