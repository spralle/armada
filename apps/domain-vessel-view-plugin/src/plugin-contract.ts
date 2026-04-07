import type { PluginContract } from "@armada/plugin-contracts";

const pluginContract = {
  manifest: {
    id: "com.armada.domain.vessel-view",
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
        pluginId: "com.armada.shared.ui-capabilities",
        versionRange: "^0.1.0",
      },
    ],
    components: [
      {
        id: "com.armada.component.jsonform.control",
        versionRange: "^0.1.0",
      },
      {
        id: "com.armada.component.entity-list.seed",
        versionRange: "^0.1.0",
      },
    ],
  },
} as PluginContract;

export default pluginContract;
