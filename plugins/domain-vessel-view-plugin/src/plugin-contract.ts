import type { PluginContract } from "@ghost-shell/plugin-contracts";

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
