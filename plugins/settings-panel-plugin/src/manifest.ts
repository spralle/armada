import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  displayName: "Settings Panel",
  contributes: {
    parts: [
      {
        id: "ghost.shell.settings",
        title: "Settings",
      },
      {
        id: "ghost.shell.settings.diagnostics",
        title: "Configuration Diagnostics",
      },
    ],
  },
  dependsOn: {
    services: [
      {
        id: "ghost.configuration.Service",
        versionRange: "^1.0.0",
        optional: true,
      },
    ],
    plugins: [
      {
        pluginId: "ghost.ui",
        versionRange: "^1.0.0",
      },
      {
        pluginId: "ghost.shadcn.theme-bridge",
        versionRange: "^1.0.0",
      },
    ],
  },
});
