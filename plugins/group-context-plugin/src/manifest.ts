import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  displayName: "Group Context",
  contributes: {
    parts: [
      {
        id: "ghost.shell.group-context",
        title: "Group context",
      },
    ],
  },
  dependsOn: {
    services: [
      {
        id: "ghost.context.Service",
        versionRange: "^1.0.0",
      },
      {
        id: "ghost.syncStatus.Service",
        versionRange: "^1.0.0",
      },
    ],
  },
});
