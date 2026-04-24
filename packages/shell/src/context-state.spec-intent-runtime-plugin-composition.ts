import {
  composeEnabledPluginContributions,
  type PluginContributionSource,
} from "@ghost-shell/plugin-system";
import { createContract } from "./context-state.spec-intent-runtime-fixtures.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

export function registerIntentRuntimePluginCompositionSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("registry composition includes two plugin-contributed parts only from enabled contracts", () => {
    const composed = composeEnabledPluginContributions([
      {
        id: "ghost.domain.unplanned-orders",
        enabled: true,
        contract: createContract({
          manifest: {
            id: "ghost.domain.unplanned-orders",
            name: "Unplanned Orders",
            version: "0.1.0",
          },
          contributes: {
            parts: [
              {
                id: "domain.unplanned-orders.part",
                title: "Unplanned Orders",
                dock: {
                  container: "main",
                },
                component: "UnplannedOrdersPart",
              },
            ],
          },
        }),
      },
      {
        id: "ghost.domain.vessel-view",
        enabled: true,
        contract: createContract({
          manifest: {
            id: "ghost.domain.vessel-view",
            name: "Vessel View",
            version: "0.1.0",
          },
          contributes: {
            parts: [
              {
                id: "domain.vessel-view.part",
                title: "Vessel View",
                dock: {
                  container: "secondary",
                },
                component: "VesselViewPart",
              },
            ],
          },
        }),
      },
      {
        id: "ghost.domain.disabled",
        enabled: false,
        contract: createContract({
          manifest: {
            id: "ghost.domain.disabled",
            name: "Disabled Domain",
            version: "0.1.0",
          },
          contributes: {
            parts: [
              {
                id: "domain.disabled.part",
                title: "Disabled",
                dock: {
                  container: "side",
                },
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
      "ghost.domain.unplanned-orders:domain.unplanned-orders.part,ghost.domain.vessel-view:domain.vessel-view.part",
      "composed parts should preserve enabled plugin contribution ordering",
    );
  });
}
