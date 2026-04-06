import type { PluginContract } from "@armada/plugin-contracts";

const pluginContract: PluginContract = {
  manifest: {
    id: "com.armada.domain.vessel-view",
    name: "Vessel View (RORO/ROPAX)",
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
