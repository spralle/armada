import {
  composeEnabledPluginContributions,
  type PluginContributionSource,
} from "@armada/plugin-contracts";
import { createContract } from "./context-state.spec-intent-runtime-fixtures.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

export function registerIntentRuntimePluginCompositionSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

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
