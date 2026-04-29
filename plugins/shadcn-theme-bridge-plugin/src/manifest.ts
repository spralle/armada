import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  displayName: "shadcn Theme Bridge",
  activationEvents: ["onStartup"],
  contributes: {
    capabilities: {
      services: [
        {
          id: "ghost.shadcn.theme-bridge",
          version: "1.0.0",
        },
      ],
    },
  },
});
