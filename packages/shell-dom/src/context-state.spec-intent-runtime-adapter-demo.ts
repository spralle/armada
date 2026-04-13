import { resolveIntent, resolveIntentWithTrace } from "./intent-runtime.js";
import type { IntentWhenMatcher } from "./intents/matcher/contracts.js";
import { createCatalog, createContract } from "./context-state.spec-intent-runtime-fixtures.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

export function registerIntentRuntimeAdapterDemoSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

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
        id: "ghost.domain.unplanned-orders",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "ghost.domain.unplanned-orders",
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
        id: "ghost.domain.unplanned-orders",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "ghost.domain.unplanned-orders",
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
        id: "ghost.domain.vessel-view",
        enabled: true,
        loadMode: "local-source",
        contract: createContract({
          manifest: {
            id: "ghost.domain.vessel-view",
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
}
