import type { PluginContract } from "@ghost/plugin-contracts";
import { INTENT_ENTITY_OPEN, INTENT_ENTITY_INSPECT } from "@ghost/plugin-contracts";

const pluginContract: PluginContract = {
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
    actions: [
      {
        id: "domain.unplanned-orders.open",
        title: "Open Unplanned Orders",
        intent: INTENT_ENTITY_OPEN,
        predicate: { entityType: { $eq: "order" } },
      },
      {
        id: "domain.unplanned-orders.inspect",
        title: "Inspect Order Details",
        intent: INTENT_ENTITY_INSPECT,
        predicate: { entityType: { $eq: "order" } },
      },
    ],
    selection: [
      {
        id: "domain.unplanned-orders.selection",
        receiverEntityType: "vessel",
        interests: [],
      },
    ],
  },
};

export default pluginContract;
