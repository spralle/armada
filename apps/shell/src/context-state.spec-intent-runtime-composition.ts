import {
  composeEnabledPluginContributions,
  type PluginContract,
  type PluginContributionSource,
} from "@armada/plugin-contracts";
import {
  createActionCatalogFromRegistrySnapshot,
  resolveIntent,
  resolveIntentWithTrace,
} from "./intent-runtime.js";
import type { IntentWhenMatcher } from "./intents/matcher/contracts.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

type CatalogPlugin = {
  id: string;
  enabled: boolean;
  loadMode: string;
  contract: PluginContract;
};

type RuntimeActionContract = {
  manifest: {
    id: string;
    name: string;
    version: string;
  };
  contributes: {
    actions?: {
      id: string;
      title: string;
      handler: string;
      intentType: string;
      when: Record<string, unknown>;
    }[];
    parts?: {
      id: string;
      title: string;
      slot: "main" | "secondary" | "side";
      component: string;
    }[];
  };
};

function createCatalog(plugins: CatalogPlugin[]) {
  return createActionCatalogFromRegistrySnapshot({ plugins });
}

function createContract(contract: RuntimeActionContract): PluginContract {
  return contract as unknown as PluginContract;
}

export function registerIntentRuntimeCompositionSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("intent runtime resolves actions by when predicate and autoruns single match", () => {
    const catalog = createCatalog([
      {
        id: "plugin-orders",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "plugin-orders",
            name: "Orders",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "orders.assign",
                title: "Assign",
                handler: "assignOrderToVessel",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                  targetType: "vessel",
                  "target.vesselClass": "RORO",
                },
              },
            ],
          },
        }),
      },
    ]);

    const resolution = resolveIntent(catalog, {
      type: "domain.orders.assign-to-vessel",
      facts: {
        sourceType: "order",
        targetType: "vessel",
        target: {
          vesselClass: "RORO",
        },
      },
    });

    assertEqual(resolution.kind, "single-match", "single matching action should autorun");
    if (resolution.kind === "single-match") {
      assertEqual(resolution.matches[0].handler, "assignOrderToVessel", "single match should resolve expected handler");
    }
  });

  test("intent runtime returns chooser for deterministic multiple matches", () => {
    const catalog = createCatalog([
      {
        id: "plugin-b",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "plugin-b",
            name: "Plugin B",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "z-handler",
                title: "Action Z",
                handler: "zHandler",
                intentType: "domain.orders.assign-to-vessel",
                when: { sourceType: "order" },
              },
            ],
          },
        }),
      },
      {
        id: "plugin-a",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "plugin-a",
            name: "Plugin A",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "a-handler",
                title: "Action A",
                handler: "aHandler",
                intentType: "domain.orders.assign-to-vessel",
                when: { sourceType: "order" },
              },
            ],
          },
        }),
      },
    ]);

    const resolution = resolveIntent(catalog, {
      type: "domain.orders.assign-to-vessel",
      facts: {
        sourceType: "order",
      },
    });

    assertEqual(resolution.kind, "multiple-matches", "multiple matching actions should open chooser");
    if (resolution.kind === "multiple-matches") {
      assertEqual(resolution.matches[0].pluginId, "plugin-a", "matches must be deterministic by plugin/action sort");
      assertEqual(resolution.matches[1].pluginId, "plugin-b", "matches must be deterministic by plugin/action sort");
    }
  });

  test("intent runtime returns clear feedback for no matches", () => {
    const catalog = createCatalog([
      {
        id: "plugin-orders",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "plugin-orders",
            name: "Orders",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "orders.assign",
                title: "Assign",
                handler: "assignOrderToVessel",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                },
              },
            ],
          },
        }),
      },
    ]);

    const resolution = resolveIntent(catalog, {
      type: "domain.orders.assign-to-vessel",
      facts: {
        sourceType: "vessel",
      },
    });

    assertEqual(resolution.kind, "no-match", "non-matching intent facts should produce no-match");
    if (resolution.kind === "no-match") {
      assertEqual(
        resolution.feedback,
        "No actions matched intent 'domain.orders.assign-to-vessel'.",
        "no-match feedback should be explicit",
      );
    }
  });

  test("intent runtime trace includes matched actions and failed predicates", () => {
    const catalog = createCatalog([
      {
        id: "plugin-orders",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "plugin-orders",
            name: "Orders",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "orders.assign-roro",
                title: "Assign RORO",
                handler: "assignOrderToRoroVessel",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                  "target.vesselClass": "RORO",
                },
              },
              {
                id: "orders.assign-tanker",
                title: "Assign tanker",
                handler: "assignOrderToTanker",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                  "target.vesselClass": "TANKER",
                },
              },
            ],
          },
        }),
      },
    ]);

    const traced = resolveIntentWithTrace(catalog, {
      type: "domain.orders.assign-to-vessel",
      facts: {
        sourceType: "order",
        target: {
          vesselClass: "RORO",
        },
      },
    });

    assertEqual(traced.resolution.kind, "single-match", "trace resolution should keep original single-match behavior");
    assertEqual(traced.trace.matched.length, 1, "trace should contain exactly one matched action");
    assertEqual(traced.trace.matched[0].actionId, "orders.assign-roro", "matched action should be captured in trace");

    const failed = traced.trace.actions.find((item) => item.actionId === "orders.assign-tanker");
    assertTruthy(failed, "non-matching action should exist in action trace");
    assertEqual(failed?.failedPredicates.length, 1, "trace should include failed predicate details for non-match");
    assertEqual(
      failed?.failedPredicates[0]?.path,
      "target.vesselClass",
      "failed predicate path should identify predicate location",
    );
  });

  test("intent runtime matcher operators evaluate deterministically", () => {
    const catalog = createCatalog([
      {
        id: "plugin-operator",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "plugin-operator",
            name: "Operator Plugin",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "orders.operator-match",
                title: "Operator match",
                handler: "operatorMatch",
                intentType: "domain.orders.filter",
                when: {
                  mode: { $eq: "strict", $ne: "legacy" },
                  status: { $in: ["open", "pending"] },
                  rank: { $gt: 1, $gte: 2, $lt: 4, $lte: 3 },
                  "meta.source": { $exists: true },
                  category: { $nin: ["forbidden"] },
                },
              },
            ],
          },
        }),
      },
    ]);

    const traced = resolveIntentWithTrace(catalog, {
      type: "domain.orders.filter",
      facts: {
        mode: "strict",
        status: "open",
        rank: 2,
        meta: { source: "manual" },
        category: "safe",
      },
    });

    assertEqual(traced.resolution.kind, "single-match", "operator predicate should resolve matching action");
    assertEqual(traced.trace.matched.length, 1, "operator predicate should produce one deterministic match");
  });

  test("intent runtime trace includes failed operator predicate details", () => {
    const catalog = createCatalog([
      {
        id: "plugin-operator-failure",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "plugin-operator-failure",
            name: "Operator Failure Plugin",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "orders.operator-failure",
                title: "Operator failure",
                handler: "operatorFailure",
                intentType: "domain.orders.filter",
                when: {
                  rank: { $gt: 10 },
                },
              },
            ],
          },
        }),
      },
    ]);

    const traced = resolveIntentWithTrace(catalog, {
      type: "domain.orders.filter",
      facts: {
        rank: 2,
      },
    });

    assertEqual(traced.resolution.kind, "no-match", "failed operator predicate should not resolve action");
    assertEqual(traced.trace.actions.length, 1, "single action should still be traced");
    assertEqual(traced.trace.actions[0].failedPredicates.length, 1, "operator mismatch should be captured in trace");
    assertEqual(traced.trace.actions[0].failedPredicates[0].path, "rank", "operator mismatch path should be traced");
  });

  test("intent runtime matcher boundary allows matcher adapter injection", () => {
    const catalog = createCatalog([
      {
        id: "plugin-adapter",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "plugin-adapter",
            name: "Adapter Plugin",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "orders.custom-matcher",
                title: "Custom matcher",
                handler: "customMatcher",
                intentType: "domain.orders.adapter",
                when: {
                  sourceType: "order",
                },
              },
            ],
          },
        }),
      },
    ]);

    const matcherCalls: string[] = [];
    const adapterMatcher: IntentWhenMatcher = {
      id: "spec-adapter",
      evaluate: (when, facts) => {
        const factRecord = facts as Record<string, unknown>;
        matcherCalls.push(`${Object.keys(when).join(",")}:${String(factRecord.sourceType)}`);
        return {
          matched: true,
          failedPredicates: [],
        };
      },
    };

    const traced = resolveIntentWithTrace(
      catalog,
      {
        type: "domain.orders.adapter",
        facts: {
          sourceType: "order",
        },
      },
      {
        matcher: adapterMatcher,
      },
    );

    assertEqual(matcherCalls.length, 1, "custom matcher should evaluate predicates through adapter boundary");
    assertEqual(traced.resolution.kind, "single-match", "adapter matcher should preserve runtime resolution behavior");
  });

  test("demo local plugins resolve single-match autorun for order->vessel intent", () => {
    const catalog = createCatalog([
      {
        id: "com.armada.domain.unplanned-orders",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "com.armada.domain.unplanned-orders",
            name: "Unplanned Orders",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "domain.orders.assign-to-vessel",
                title: "Assign order to selected vessel",
                handler: "assignOrderToVessel",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                  targetType: "vessel",
                },
              },
            ],
          },
        }),
      },
    ]);

    const resolution = resolveIntent(catalog, {
      type: "domain.orders.assign-to-vessel",
      facts: {
        sourceType: "order",
        targetType: "vessel",
        target: {
          vesselClass: "ROPAX",
        },
      },
    });

    assertEqual(resolution.kind, "single-match", "demo unplanned orders action should autorun as single match");
  });

  test("demo local plugins resolve chooser for order->vessel intent on RORO", () => {
    const catalog = createCatalog([
      {
        id: "com.armada.domain.unplanned-orders",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "com.armada.domain.unplanned-orders",
            name: "Unplanned Orders",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "domain.orders.assign-to-vessel",
                title: "Assign order to selected vessel",
                handler: "assignOrderToVessel",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                  targetType: "vessel",
                },
              },
            ],
          },
        }),
      },
      {
        id: "com.armada.domain.vessel-view",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "com.armada.domain.vessel-view",
            name: "Vessel View (RORO/ROPAX)",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "domain.vessel.assign-roro",
                title: "Assign order to RORO vessel",
                handler: "assignOrderToRoroVessel",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                  targetType: "vessel",
                  "target.vesselClass": "RORO",
                },
              },
            ],
          },
        }),
      },
    ]);

    const resolution = resolveIntent(catalog, {
      type: "domain.orders.assign-to-vessel",
      facts: {
        sourceType: "order",
        targetType: "vessel",
        target: {
          vesselClass: "RORO",
        },
      },
    });

    assertEqual(resolution.kind, "multiple-matches", "demo order->vessel flow should open chooser for RORO");
  });

  test("registry composition includes two plugin-contributed parts only from enabled contracts", () => {
    const composed = composeEnabledPluginContributions([
      {
        id: "com.armada.domain.unplanned-orders",
        enabled: true,
        contract: createContract({
          manifest: {
            id: "com.armada.domain.unplanned-orders",
            name: "Unplanned Orders",
            version: "0.1.0",
          },
          contributes: {
            parts: [
              {
                id: "domain.unplanned-orders.part",
                title: "Unplanned Orders",
                slot: "main",
                component: "UnplannedOrdersPart",
              },
            ],
          },
        }),
      },
      {
        id: "com.armada.domain.vessel-view",
        enabled: true,
        contract: createContract({
          manifest: {
            id: "com.armada.domain.vessel-view",
            name: "Vessel View",
            version: "0.1.0",
          },
          contributes: {
            parts: [
              {
                id: "domain.vessel-view.part",
                title: "Vessel View",
                slot: "secondary",
                component: "VesselViewPart",
              },
            ],
          },
        }),
      },
      {
        id: "com.armada.domain.disabled",
        enabled: false,
        contract: createContract({
          manifest: {
            id: "com.armada.domain.disabled",
            name: "Disabled Domain",
            version: "0.1.0",
          },
          contributes: {
            parts: [
              {
                id: "domain.disabled.part",
                title: "Disabled",
                slot: "side",
                component: "DisabledPart",
              },
            ],
          },
        }),
      },
    ] satisfies PluginContributionSource[]);

    assertEqual(composed.parts.length, 2, "only enabled plugin-contributed parts should be composed");
    assertEqual(
      composed.parts.map((part) => `${part.pluginId}:${part.id}`).join(","),
      "com.armada.domain.unplanned-orders:domain.unplanned-orders.part,com.armada.domain.vessel-view:domain.vessel-view.part",
      "composed parts should preserve enabled plugin contribution ordering",
    );
  });
}
