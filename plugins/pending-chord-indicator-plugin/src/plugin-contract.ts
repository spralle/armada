import type { PluginContract } from "@ghost/plugin-contracts";

const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.pending-chord-indicator",
    name: "Pending Chord Indicator",
    version: "1.0.0",
  },
  contributes: {
    slots: [
      {
        id: "pending-chord-indicator",
        slot: "top",
        position: "end",
        order: -10, // negative order = before clock (order 0)
        component: "pending-chord-indicator",
      },
    ],
  },
};

export { pluginContract };
