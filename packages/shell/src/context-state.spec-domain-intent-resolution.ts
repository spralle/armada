import {
  createIntentRuntime,
  type IntentResolutionDelegate,
  type IntentActionMatch,
  type ShellIntent,
  type IntentResolutionTrace,
  type IntentResolutionOutcome,
} from "@ghost-shell/intents";
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

function createSnapshotDeps(plugins: Parameters<typeof createCatalog>[0]) {
  return { getRegistrySnapshot: () => ({ plugins }) };
}

const domainOrdersPlugin = {
  id: "ghost.domain.unplanned-orders",
  enabled: true,
  loadMode: "local-source",
  contract: createContract({
    manifest: { id: "ghost.domain.unplanned-orders", name: "Unplanned Orders", version: "0.1.0" },
    contributes: {
      actions: [
        { id: "domain.unplanned-orders.open", title: "Open Unplanned Orders", intent: "domain.entity.open", when: { entityType: "order" } },
        { id: "domain.unplanned-orders.inspect", title: "Inspect Order Details", intent: "domain.entity.inspect", when: { entityType: "order" } },
      ],
    },
  }),
};

const domainVesselPlugin = {
  id: "ghost.domain.vessel-view",
  enabled: true,
  loadMode: "local-source",
  contract: createContract({
    manifest: { id: "ghost.domain.vessel-view", name: "Vessel View", version: "0.1.0" },
    contributes: {
      actions: [
        { id: "domain.vessel-view.open", title: "Open Vessel View", intent: "domain.entity.open", when: { entityType: "vessel" } },
        { id: "domain.vessel-view.inspect", title: "Inspect Vessel Details", intent: "domain.entity.inspect", when: { entityType: "vessel" } },
      ],
    },
  }),
};

export function registerDomainIntentResolutionSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;
  const bothPlugins = [domainOrdersPlugin, domainVesselPlugin];

  // Scenario 1: domain.entity.open + entityType=order → orders plugin
  test("domain: entity.open with entityType=order resolves to orders plugin", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(bothPlugins));
    const delegate = createMockDelegate();
    const intent: ShellIntent = { type: "domain.entity.open", facts: { entityType: "order" } };

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "executed", "single match auto-executes");
    if (outcome.kind === "executed") {
      assertEqual(outcome.match.pluginId, "ghost.domain.unplanned-orders", "orders plugin matched");
      assertEqual(outcome.match.actionId, "domain.unplanned-orders.open", "open action matched");
    }
    assertEqual(delegate.calls.showChooser, 0, "no chooser for single match");
  });

  // Scenario 2: domain.entity.open + entityType=vessel → vessel plugin
  test("domain: entity.open with entityType=vessel resolves to vessel plugin", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(bothPlugins));
    const delegate = createMockDelegate();
    const intent: ShellIntent = { type: "domain.entity.open", facts: { entityType: "vessel" } };

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "executed", "single match auto-executes");
    if (outcome.kind === "executed") {
      assertEqual(outcome.match.pluginId, "ghost.domain.vessel-view", "vessel plugin matched");
      assertEqual(outcome.match.actionId, "domain.vessel-view.open", "open action matched");
    }
    assertEqual(delegate.calls.showChooser, 0, "no chooser for single match");
  });

  // Scenario 3: domain.entity.open + no entityType → no match
  test("domain: entity.open with empty facts yields no match", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(bothPlugins));
    const delegate = createMockDelegate();
    const intent: ShellIntent = { type: "domain.entity.open", facts: {} };

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "no-match", "missing entityType fails all predicates");
    if (outcome.kind === "no-match") {
      assertTruthy(outcome.feedback.length > 0, "feedback present");
    }
  });

  // Scenario 4: two plugins both match same facts → multi-match/chooser
  test("domain: two plugins matching same facts invokes showChooser", async () => {
    const duplicateOrdersPlugin = {
      id: "ghost.domain.alternate-orders",
      enabled: true,
      loadMode: "local-source",
      contract: createContract({
        manifest: { id: "ghost.domain.alternate-orders", name: "Alternate Orders", version: "0.1.0" },
        contributes: {
          actions: [
            { id: "domain.alternate-orders.open", title: "Open Alternate Orders", intent: "domain.entity.open", when: { entityType: "order" } },
          ],
        },
      }),
    };

    const runtime = createIntentRuntime(createSnapshotDeps([domainOrdersPlugin, duplicateOrdersPlugin]));
    const delegate = createMockDelegate();
    const intent: ShellIntent = { type: "domain.entity.open", facts: { entityType: "order" } };

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "executed", "chooser picks first match by default");
    assertEqual(delegate.calls.showChooser, 1, "showChooser invoked for multi-match");
  });

  // Scenario 5: trace shows correct failedPredicates for vessel plugin
  test("domain: trace shows failedPredicates for non-matching plugin", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(bothPlugins));
    const delegate = createMockDelegate();
    const intent: ShellIntent = { type: "domain.entity.open", facts: { entityType: "order" } };

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "executed", "resolves to executed");
    const vesselOpenTrace = outcome.trace.actions.find((a) => a.actionId === "domain.vessel-view.open");
    assertTruthy(vesselOpenTrace, "vessel open action present in trace");
    assertEqual(vesselOpenTrace?.predicateMatched, false, "vessel predicate did not match");
    assertTruthy(vesselOpenTrace?.failedPredicates.length ?? 0 > 0, "vessel has failed predicates");
    assertEqual(vesselOpenTrace?.failedPredicates[0]?.path, "entityType", "failed predicate path is entityType");
  });

  // Scenario 6: domain.entity.inspect follows same resolution
  test("domain: entity.inspect with entityType=vessel resolves to vessel inspect", async () => {
    const runtime = createIntentRuntime(createSnapshotDeps(bothPlugins));
    const delegate = createMockDelegate();
    const intent: ShellIntent = { type: "domain.entity.inspect", facts: { entityType: "vessel" } };

    const outcome = await runtime.resolve(intent, delegate);

    assertEqual(outcome.kind, "executed", "single match auto-executes");
    if (outcome.kind === "executed") {
      assertEqual(outcome.match.pluginId, "ghost.domain.vessel-view", "vessel plugin matched");
      assertEqual(outcome.match.actionId, "domain.vessel-view.inspect", "inspect action matched");
    }
  });
}
