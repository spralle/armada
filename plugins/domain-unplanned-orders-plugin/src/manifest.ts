import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  "displayName": "Unplanned Orders",
  "contributes": {
    "parts": [
      {
        "id": "domain.unplanned-orders.part",
        "title": "Unplanned Orders",
        "dock": {
          "container": "main"
        },
        "component": "UnplannedOrdersPart"
      }
    ],
    "actions": [
      {
        "id": "domain.unplanned-orders.open",
        "title": "Open Unplanned Orders",
        "intent": "domain.entity.open",
        "when": {
          "entityType": {
            "$eq": "order"
          }
        }
      },
      {
        "id": "domain.unplanned-orders.inspect",
        "title": "Inspect Order Details",
        "intent": "domain.entity.inspect",
        "when": {
          "entityType": {
            "$eq": "order"
          }
        }
      }
    ],
    "selection": [
      {
        "id": "domain.unplanned-orders.selection",
        "receiverEntityType": "vessel",
        "interests": []
      }
    ]
  }
});
