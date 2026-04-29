import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  displayName: "Vessel View (RORO/ROPAX)",
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
        intent: "domain.entity.open",
        when: {
          entityType: {
            $eq: "vessel",
          },
        },
      },
      {
        id: "domain.vessel-view.inspect",
        title: "Inspect Vessel Details",
        intent: "domain.entity.inspect",
        when: {
          entityType: {
            $eq: "vessel",
          },
        },
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
});
