import { resolveIntent, resolveIntentWithTrace } from "./intent-runtime.js";
import { createCatalog, createContract } from "./context-state.spec-intent-runtime-fixtures.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

export function registerIntentRuntimeResolutionSpecs(harness: SpecHarness): void {
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
}
