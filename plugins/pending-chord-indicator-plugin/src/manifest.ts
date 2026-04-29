import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  displayName: "Pending Chord Indicator",
  contributes: {
    slots: [
      {
        id: "pending-chord-indicator",
        slot: "top",
        position: "end",
        order: -10,
        component: "pending-chord-indicator",
      },
    ],
  },
});
