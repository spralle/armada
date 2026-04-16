import type { PluginContract } from "@ghost/plugin-contracts";

export const WORKSPACE_INDICATOR_PLUGIN_ID = "com.ghost.shell.workspace-indicator";

export function createWorkspaceIndicatorContract(): PluginContract {
  return {
    manifest: {
      id: WORKSPACE_INDICATOR_PLUGIN_ID,
      name: "Workspace Indicator",
      version: "1.0.0",
    },
    contributes: {
      slots: [
        {
          id: "workspace-indicator",
          slot: "top",
          position: "start",
          order: 0,
          component: "workspace-indicator",
        },
      ],
    },
  };
}
