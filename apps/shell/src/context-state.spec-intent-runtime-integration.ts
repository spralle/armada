import {
  createIntentRuntime,
  type IntentResolutionDelegate,
  type IntentActionMatch,
  type ShellIntent,
  type IntentResolutionTrace,
  type IntentResolutionOutcome,
} from "./intent-runtime.js";
import { createCatalog, createContract } from "./context-state.spec-intent-runtime-fixtures.js";
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
      if (overrides.showChooser) {
        return overrides.showChooser(matches, intent, trace);
      }
      return matches[0] ?? null;
    },
    async activatePlugin(pluginId, trigger) {
      calls.activatePlugin.push({ pluginId, trigger });
      if (overrides.activatePlugin) {
        return overrides.activatePlugin(pluginId, trigger);
      }
      return true;
    },
    announce(message) {
      calls.announce.push(message);
      if (overrides.announce) {
        overrides.announce(message);
      }
    },
  };
}

function createSnapshotDeps(plugins: Parameters<typeof createCatalog>[0]) {
  const snapshot = { plugins };
  return {
    getRegistrySnapshot: () => snapshot,
  };
}

function assertTracePopulated(
  harness: SpecHarness,
  outcome: IntentResolutionOutcome,
  intentType: string,
  label: string,
): void {
  const { assertEqual, assertTruthy } = harness;
  const trace = outcome.trace;
  assertEqual(trace.intentType, intentType, `${label}: trace.intentType`);
  assertTruthy(typeof trace.evaluatedAt === "number", `${label}: trace.evaluatedAt is number`);
  assertTruthy(Array.isArray(trace.actions), `${label}: trace.actions is array`);
  assertTruthy(Array.isArray(trace.matched), `${label}: trace.matched is array`);
}

export function registerIntentRuntimeIntegrationSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  // Scenario 1: Single-match auto-execution
  test("integration: single-match auto-executes and calls activatePlugin", async () => {
    const plugins = [
      {
        id: "plugin-orders",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: { id: "plugin-orders", name: "Orders", version: "0.1.0" },
          contributes: {
            actions: [
              {
                id: "orders.assign",
                title: "Assign Order",
                intent: "domain.orders.assign",
                when: { sourceType: "order" },
              },
            ],
          },
        }),
      },
    ];

    const runtime = createIntentRuntime(createSnapshotDeps(plugins));
    const delegate = createMockDelegate();
    const intent: ShellIntent = { type: "domain.orders.assign", facts: { sourceType: "order" } };

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "executed", "single match should auto-execute");
    if (outcome.kind === "executed") {
      assertEqual(outcome.match.actionId, "orders.assign", "correct action selected");
      assertEqual(outcome.match.pluginId, "plugin-orders", "correct plugin");
    }
    assertEqual(delegate.calls.activatePlugin.length, 1, "activatePlugin called once");
    assertEqual(delegate.calls.activatePlugin[0].pluginId, "plugin-orders", "activatePlugin correct plugin");
    assertEqual(delegate.calls.showChooser, 0, "showChooser not called for single match");
    assertTracePopulated(harness, outcome, "domain.orders.assign", "scenario1");
  });

  // Scenario 2: No-match feedback
  test("integration: no-match returns feedback and calls announce", async () => {
    const plugins = [
      {
        id: "plugin-orders",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: { id: "plugin-orders", name: "Orders", version: "0.1.0" },
          contributes: {
            actions: [
              {
                id: "orders.assign",
                title: "Assign",
                intent: "domain.orders.assign",
                when: { sourceType: "order" },
              },
            ],
          },
        }),
      },
    ];

    const runtime = createIntentRuntime(createSnapshotDeps(plugins));
    const delegate = createMockDelegate();
    const intent: ShellIntent = { type: "domain.unknown.action", facts: { sourceType: "order" } };

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "no-match", "unmatched intent type yields no-match");
    if (outcome.kind === "no-match") {
      assertTruthy(outcome.feedback.length > 0, "feedback message present");
    }
    assertTruthy(delegate.calls.announce.length > 0, "announce called for no-match");
    assertEqual(delegate.calls.activatePlugin.length, 0, "activatePlugin not called for no-match");
    assertTracePopulated(harness, outcome, "domain.unknown.action", "scenario2");
  });

  // Scenario 3: Multi-match shows chooser
  test("integration: multi-match delegates to showChooser and executes chosen", async () => {
    const plugins = [
      {
        id: "plugin-a",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: { id: "plugin-a", name: "Plugin A", version: "0.1.0" },
          contributes: {
            actions: [
              { id: "a-handler", title: "Action A", intent: "domain.shared.action", when: { sourceType: "order" } },
            ],
          },
        }),
      },
      {
        id: "plugin-b",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: { id: "plugin-b", name: "Plugin B", version: "0.1.0" },
          contributes: {
            actions: [
              { id: "b-handler", title: "Action B", intent: "domain.shared.action", when: { sourceType: "order" } },
            ],
          },
        }),
      },
    ];

    const runtime = createIntentRuntime(createSnapshotDeps(plugins));
    const delegate = createMockDelegate({
      async showChooser(matches) {
        // Pick the second match
        return matches[1] ?? null;
      },
    });
    const intent: ShellIntent = { type: "domain.shared.action", facts: { sourceType: "order" } };

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "executed", "chooser selection leads to execution");
    if (outcome.kind === "executed") {
      assertEqual(outcome.match.pluginId, "plugin-b", "second match (plugin-b) selected by chooser");
    }
    assertEqual(delegate.calls.activatePlugin.length, 1, "activatePlugin called once");
    assertTracePopulated(harness, outcome, "domain.shared.action", "scenario3");
  });

  // Scenario 4: Chooser cancellation
  test("integration: chooser cancellation returns cancelled outcome", async () => {
    const plugins = [
      {
        id: "plugin-a",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: { id: "plugin-a", name: "Plugin A", version: "0.1.0" },
          contributes: {
            actions: [
              { id: "a-handler", title: "Action A", intent: "domain.shared.action", when: { sourceType: "order" } },
            ],
          },
        }),
      },
      {
        id: "plugin-b",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: { id: "plugin-b", name: "Plugin B", version: "0.1.0" },
          contributes: {
            actions: [
              { id: "b-handler", title: "Action B", intent: "domain.shared.action", when: { sourceType: "order" } },
            ],
          },
        }),
      },
    ];

    const runtime = createIntentRuntime(createSnapshotDeps(plugins));
    const delegate = createMockDelegate({
      async showChooser() {
        return null; // User dismissed
      },
    });
    const intent: ShellIntent = { type: "domain.shared.action", facts: { sourceType: "order" } };

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "cancelled", "null from showChooser yields cancelled");
    assertEqual(delegate.calls.activatePlugin.length, 0, "activatePlugin not called on cancellation");
    assertTracePopulated(harness, outcome, "domain.shared.action", "scenario4");
  });

  // Scenario 5: Preferred action auto-selection
  test("integration: preferredActionId bypasses chooser", async () => {
    const plugins = [
      {
        id: "plugin-a",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: { id: "plugin-a", name: "Plugin A", version: "0.1.0" },
          contributes: {
            actions: [
              { id: "a-handler", title: "Action A", intent: "domain.shared.action", when: { sourceType: "order" } },
            ],
          },
        }),
      },
      {
        id: "plugin-b",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: { id: "plugin-b", name: "Plugin B", version: "0.1.0" },
          contributes: {
            actions: [
              { id: "b-handler", title: "Action B", intent: "domain.shared.action", when: { sourceType: "order" } },
            ],
          },
        }),
      },
    ];

    const runtime = createIntentRuntime(createSnapshotDeps(plugins));
    const delegate = createMockDelegate();
    const intent: ShellIntent = { type: "domain.shared.action", facts: { sourceType: "order" } };

    const outcome = await runtime.resolve(intent, delegate, { preferredActionId: "b-handler" });

    assertEqual(outcome.kind, "executed", "preferred action leads to execution");
    if (outcome.kind === "executed") {
      assertEqual(outcome.match.actionId, "b-handler", "preferred action selected");
      assertEqual(outcome.match.pluginId, "plugin-b", "preferred action from correct plugin");
    }
    assertEqual(delegate.calls.showChooser, 0, "showChooser not called when preferred action matches");
    assertEqual(delegate.calls.activatePlugin.length, 1, "activatePlugin called once");
    assertTracePopulated(harness, outcome, "domain.shared.action", "scenario5");
  });

  // Scenario 6: Predicate-based filtering
  test("integration: predicate filtering reduces to single match with failed-predicate trace", async () => {
    const plugins = [
      {
        id: "plugin-orders",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: { id: "plugin-orders", name: "Orders", version: "0.1.0" },
          contributes: {
            actions: [
              {
                id: "orders.assign-roro",
                title: "Assign RORO",
                intent: "domain.orders.assign",
                when: { sourceType: "order", "target.vesselClass": "RORO" },
              },
              {
                id: "orders.assign-tanker",
                title: "Assign Tanker",
                intent: "domain.orders.assign",
                when: { sourceType: "order", "target.vesselClass": "TANKER" },
              },
            ],
          },
        }),
      },
    ];

    const runtime = createIntentRuntime(createSnapshotDeps(plugins));
    const delegate = createMockDelegate();
    const intent: ShellIntent = {
      type: "domain.orders.assign",
      facts: { sourceType: "order", target: { vesselClass: "RORO" } },
    };

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "executed", "single predicate match auto-executes");
    if (outcome.kind === "executed") {
      assertEqual(outcome.match.actionId, "orders.assign-roro", "RORO action matched");
    }
    assertEqual(delegate.calls.showChooser, 0, "no chooser for single match after predicate filtering");

    // Verify trace shows the tanker action as failed-predicate
    const tankerTrace = outcome.trace.actions.find((a) => a.actionId === "orders.assign-tanker");
    assertTruthy(tankerTrace, "tanker action present in trace");
    assertEqual(tankerTrace?.predicateMatched, false, "tanker predicate did not match");
    assertTruthy(tankerTrace?.failedPredicates.length ?? 0 > 0, "tanker has failed predicates in trace");

    assertTracePopulated(harness, outcome, "domain.orders.assign", "scenario6");
    assertEqual(outcome.trace.matched.length, 1, "trace.matched has exactly one entry");
    assertEqual(outcome.trace.actions.length, 2, "trace.actions has both evaluated actions");
  });
}
