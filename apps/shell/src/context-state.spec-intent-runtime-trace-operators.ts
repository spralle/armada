import { resolveIntentWithTrace } from "./intent-runtime.js";
import { createCatalog, createContract } from "./context-state.spec-intent-runtime-fixtures.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

export function registerIntentRuntimeTraceOperatorsSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

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
                intent: "domain.orders.filter",
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
                intent: "domain.orders.filter",
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
}
