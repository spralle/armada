import type { PluginContract } from "@armada/plugin-contracts";

const pluginContract: PluginContract = {
  manifest: {
    id: "com.armada.domain.vessel-view",
    name: "Vessel View (RORO/ROPAX)",
    version: "0.1.0",
  },
  contributes: {
    views: [
      {
        id: "domain.vessel.view",
        title: "Vessel View",
        component: "VesselView",
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
};

export default pluginContract;
