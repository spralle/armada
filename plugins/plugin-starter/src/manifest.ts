import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  displayName: "Plugin Starter",
  contributes: {
    parts: [
      {
        id: "starter.part",
        title: "Starter View",
        dock: {
          container: "main",
        },
        component: "StarterView",
      },
    ],
  },
});
