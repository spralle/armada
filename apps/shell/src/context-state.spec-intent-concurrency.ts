import {
  createIntentRuntime,
  type IntentResolutionDelegate,
  type IntentActionMatch,
  type ShellIntent,
  type IntentResolutionTrace,
} from "./intent-runtime.js";
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

function createPlugins() {
  return [
    {
      id: "plugin-conc-orders",
      enabled: true,
      loadMode: "local-source",
      contract: createContract({
        manifest: { id: "plugin-conc-orders", name: "Conc Orders", version: "0.1.0" },
        contributes: {
          actions: [
            { id: "conc-orders.open", title: "Open Orders", intent: "conc.orders.open", when: { entity: "order" } },
          ],
        },
      }),
    },
    {
      id: "plugin-conc-vessels",
      enabled: true,
      loadMode: "local-source",
      contract: createContract({
        manifest: { id: "plugin-conc-vessels", name: "Conc Vessels", version: "0.1.0" },
        contributes: {
          actions: [
            { id: "conc-vessels.open", title: "Open Vessels", intent: "conc.vessels.open", when: { entity: "vessel" } },
          ],
        },
      }),
    },
  ];
}

function createMultiMatchPlugins() {
  return [
    {
      id: "plugin-conc-a",
      enabled: true,
      loadMode: "local-source",
      contract: createContract({
        manifest: { id: "plugin-conc-a", name: "Conc A", version: "0.1.0" },
        contributes: {
          actions: [
            { id: "conc-a.action", title: "Conc A Action", intent: "conc.shared.action", when: { scope: "shared" } },
          ],
        },
      }),
    },
    {
      id: "plugin-conc-b",
      enabled: true,
      loadMode: "local-source",
      contract: createContract({
        manifest: { id: "plugin-conc-b", name: "Conc B", version: "0.1.0" },
        contributes: {
          actions: [
            { id: "conc-b.action", title: "Conc B Action", intent: "conc.shared.action", when: { scope: "shared" } },
          ],
        },
      }),
    },
  ];
}

function createSnapshotDeps(plugins: ReturnType<typeof createPlugins> | ReturnType<typeof createMultiMatchPlugins>) {
  return { getRegistrySnapshot: () => ({ plugins }) };
}

export function registerIntentConcurrencySpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  // Scenario 1: Two concurrent resolve() calls both complete
  test("concurrency: two concurrent resolves with different intents both complete", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(createPlugins()));
    const delegate1 = createMockDelegate();
    const delegate2 = createMockDelegate();

    const intent1: ShellIntent = { type: "conc.orders.open", facts: { entity: "order" } };
    const intent2: ShellIntent = { type: "conc.vessels.open", facts: { entity: "vessel" } };

    const [outcome1, outcome2] = await Promise.all([
      runtime.resolve(intent1, delegate1),
      runtime.resolve(intent2, delegate2),
    ]);

    assertEqual(outcome1.kind, "executed", "first concurrent resolve completes");
    assertEqual(outcome2.kind, "executed", "second concurrent resolve completes");
    if (outcome1.kind === "executed") {
      assertEqual(outcome1.match.pluginId, "plugin-conc-orders", "first resolves to orders");
    }
    if (outcome2.kind === "executed") {
      assertEqual(outcome2.match.pluginId, "plugin-conc-vessels", "second resolves to vessels");
    }
  });

  // Scenario 2: Resolve during active showChooser
  test("concurrency: resolve during active showChooser both complete", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(createMultiMatchPlugins()));

    let resolveChooser: ((match: IntentActionMatch | null) => void) | null = null;
    const chooserPromise = new Promise<IntentActionMatch | null>((resolve) => {
      resolveChooser = resolve;
    });

    const delegate1 = createMockDelegate({
      showChooser(matches) {
        // Hang until resolved externally
        return chooserPromise;
      },
    });

    const delegate2 = createMockDelegate();
    const singlePlugins = createPlugins();
    const runtime2 = createIntentRuntime(createSnapshotDeps(singlePlugins));

    const intent1: ShellIntent = { type: "conc.shared.action", facts: { scope: "shared" } };
    const intent2: ShellIntent = { type: "conc.orders.open", facts: { entity: "order" } };

    const promise1 = runtime.resolve(intent1, delegate1);
    // Second resolve fires while first is in showChooser
    const outcome2 = await runtime2.resolve(intent2, delegate2);

    assertEqual(outcome2.kind, "executed", "second resolve completes while first is in chooser");

    // Now resolve the chooser
    resolveChooser!(null);
    const outcome1 = await promise1;

    assertEqual(outcome1.kind, "cancelled", "first resolve completes after chooser dismissal");
  });

  // Scenario 3: Rapid sequential resolves complete in order
  test("concurrency: rapid sequential resolves all complete without errors", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(createPlugins()));
    const intents: ShellIntent[] = [
      { type: "conc.orders.open", facts: { entity: "order" } },
      { type: "conc.vessels.open", facts: { entity: "vessel" } },
      { type: "conc.orders.open", facts: { entity: "order" } },
    ];

    const outcomes = [];
    for (const intent of intents) {
      const delegate = createMockDelegate();
      const outcome = await runtime.resolve(intent, delegate);
      outcomes.push(outcome);
    }

    assertEqual(outcomes.length, 3, "all 3 resolves completed");
    assertEqual(outcomes[0].kind, "executed", "first sequential resolve executed");
    assertEqual(outcomes[1].kind, "executed", "second sequential resolve executed");
    assertEqual(outcomes[2].kind, "executed", "third sequential resolve executed");
  });
}
