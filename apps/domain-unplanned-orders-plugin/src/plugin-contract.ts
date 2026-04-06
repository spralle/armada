import type { PluginContract } from "@armada/plugin-contracts";

const pluginContract: PluginContract = {
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
