import {
  createIntentRuntime,
  type IntentActionMatch,
  type IntentResolutionDelegate,
  type ShellIntent,
} from "@ghost-shell/intents";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { createContract } from "./context-state.spec-intent-runtime-fixtures.js";

function createMockDelegate(overrides: Partial<IntentResolutionDelegate> = {}): IntentResolutionDelegate & {
  calls: {
    activatePlugin: { pluginId: string; trigger: { type: string; id: string } }[];
    announce: string[];
    showChooser: number;
  };
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

function createMultiMatchPlugins() {
  return [
    {
      id: "plugin-alpha",
      enabled: true,
      loadStrategy: "local-source",
      contract: createContract({
        manifest: { id: "plugin-alpha", name: "Alpha", version: "0.1.0" },
        contributes: {
          actions: [
            { id: "alpha.open", title: "Alpha Open", intent: "chooser.test.action", when: { scope: "shared" } },
          ],
        },
      }),
    },
    {
      id: "plugin-beta",
      enabled: true,
      loadStrategy: "local-source",
      contract: createContract({
        manifest: { id: "plugin-beta", name: "Beta", version: "0.1.0" },
        contributes: {
          actions: [{ id: "beta.open", title: "Beta Open", intent: "chooser.test.action", when: { scope: "shared" } }],
        },
      }),
    },
  ];
}

function createSnapshotDeps(plugins: ReturnType<typeof createMultiMatchPlugins>) {
  return { getRegistrySnapshot: () => ({ plugins }) };
}

export function registerIntentChooserE2ESpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;
  const intent: ShellIntent = { type: "chooser.test.action", facts: { scope: "shared" } };

  // Scenario 1: Multi-match creates session-like state — showChooser receives correct args
  test("chooser e2e: showChooser receives correct matches and intent", async () => {
    let receivedMatches: IntentActionMatch[] = [];
    let receivedIntent: ShellIntent | undefined;

    const runtime = createIntentRuntime(createSnapshotDeps(createMultiMatchPlugins()));
    const delegate = createMockDelegate({
      async showChooser(matches, intent) {
        receivedMatches = matches;
        receivedIntent = intent;
        return matches[0] ?? null;
      },
    });

    await runtime.resolve(intent, delegate);

    assertEqual(receivedMatches.length, 2, "showChooser receives 2 matches");
    assertEqual(receivedIntent?.type, "chooser.test.action", "showChooser receives correct intent");
  });

  // Scenario 2: Chooser selection invokes correct handler
  test("chooser e2e: selecting second match activates correct plugin", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(createMultiMatchPlugins()));
    const delegate = createMockDelegate({
      async showChooser(matches) {
        return matches[1] ?? null;
      },
    });

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "executed", "selection leads to execution");
    if (outcome.kind === "executed") {
      assertEqual(outcome.match.pluginId, "plugin-beta", "second match plugin activated");
    }
    assertEqual(delegate.calls.activatePlugin.length, 1, "activatePlugin called once");
    assertEqual(delegate.calls.activatePlugin[0].pluginId, "plugin-beta", "correct plugin activated");
  });

  // Scenario 3: Chooser dismiss returns cancelled
  test("chooser e2e: returning null from showChooser yields cancelled", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(createMultiMatchPlugins()));
    const delegate = createMockDelegate({
      async showChooser() {
        return null;
      },
    });

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "cancelled", "null selection yields cancelled");
    assertEqual(delegate.calls.activatePlugin.length, 0, "activatePlugin not called on cancel");
  });

  // Scenario 4: chooserFocusIndex — matches array is correctly ordered and indexable
  test("chooser e2e: matches array is deterministically ordered and indexable", async () => {
    let matchIds: string[] = [];

    const runtime = createIntentRuntime(createSnapshotDeps(createMultiMatchPlugins()));
    const delegate = createMockDelegate({
      async showChooser(matches) {
        matchIds = matches.map((m) => m.pluginId);
        // Use index to pick
        const focusIndex = 1;
        return matches[focusIndex] ?? null;
      },
    });

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(matchIds[0], "plugin-alpha", "first match is alpha (sorted)");
    assertEqual(matchIds[1], "plugin-beta", "second match is beta (sorted)");
    assertEqual(outcome.kind, "executed", "indexed selection executes");
  });

  // Scenario 5: After execute, no lingering state
  test("chooser e2e: after execution delegate calls are complete and clean", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(createMultiMatchPlugins()));
    const delegate = createMockDelegate({
      async showChooser(matches) {
        return matches[0] ?? null;
      },
    });

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "executed", "execution completed");
    assertEqual(delegate.calls.activatePlugin.length, 1, "exactly one activation");
    assertEqual(delegate.calls.showChooser, 1, "exactly one chooser call");
    assertTruthy(delegate.calls.announce.length > 0, "announce was called");
  });
}
