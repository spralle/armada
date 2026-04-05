import type { PluginContract } from "@armada/plugin-contracts";

const pluginContract: PluginContract = {
  manifest: {
    id: "com.armada.domain.unplanned-orders",
    name: "Unplanned Orders",
    version: "0.1.0",
  },
  contributes: {
    views: [
      {
        id: "domain.unplanned-orders.view",
        title: "Unplanned Orders",
        component: "UnplannedOrdersView",
      },
    ],
    selection: [
      {
        id: "domain.unplanned-orders.selection",
        target: "vessel",
      },
    ],
  },
};

export default pluginContract;
