import type { PluginContract } from "@ghost/plugin-contracts";
import { INTENT_ENTITY_OPEN, INTENT_ENTITY_INSPECT } from "@ghost/plugin-contracts";

const pluginContract = {
  manifest: {
    id: "ghost.domain.vessel-view",
    name: "Vessel View (RORO/ROPAX)",
    version: "0.1.0",
  },
  contributes: {
    parts: [
      {
        id: "domain.vessel.view",
        title: "Vessel View",
        dock: {
          container: "main",
        },
        component: "VesselViewPart",
      },
    ],
    actions: [
      {
        id: "domain.vessel-view.open",
        title: "Open Vessel View",
        intent: INTENT_ENTITY_OPEN,
        predicate: { entityType: { $eq: "vessel" } },
      },
      {
        id: "domain.vessel-view.inspect",
        title: "Inspect Vessel Details",
        intent: INTENT_ENTITY_INSPECT,
        predicate: { entityType: { $eq: "vessel" } },
      },
    ],
    selection: [
      {
        id: "domain.vessel.selection",
        receiverEntityType: "order",
        interests: [],
      },
    ],
  },
  dependsOn: {
    plugins: [
      {
        pluginId: "ghost.shared.ui-capabilities",
        versionRange: "^0.1.0",
      },
    ],
    components: [
      {
        id: "ghost.component.jsonform.control",
        versionRange: "^0.1.0",
      },
      {
        id: "ghost.component.entity-list.seed",
        versionRange: "^0.1.0",
      },
    ],
  },
} as PluginContract;

export default pluginContract;
