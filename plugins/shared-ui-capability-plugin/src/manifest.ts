import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  "displayName": "Shared UI Capabilities",
  "contributes": {
    "capabilities": {
      "components": [
        {
          "id": "ghost.component.jsonform.control",
          "version": "0.1.0"
        },
        {
          "id": "ghost.component.entity-list.seed",
          "version": "0.1.0"
        }
      ]
    }
  }
});
