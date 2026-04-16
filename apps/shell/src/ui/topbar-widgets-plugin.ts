import type { PluginContract } from "@ghost/plugin-contracts";

export const TOPBAR_WIDGETS_PLUGIN_ID = "com.ghost.shell.topbar-widgets";

export function createTopbarWidgetsContract(): PluginContract {
  return {
    manifest: {
      id: TOPBAR_WIDGETS_PLUGIN_ID,
      name: "Topbar Widgets",
      version: "1.0.0",
    },
    contributes: {
      slots: [
        {
          id: "topbar-title",
          slot: "top",
          position: "center",
          order: 0,
          component: "topbar-title",
        },
        {
          id: "topbar-clock",
          slot: "top",
          position: "end",
          order: 0,
          component: "topbar-clock",
        },
      ],
    },
  };
}
