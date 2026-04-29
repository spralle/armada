import { definePlugin } from "@ghost-shell/contracts/plugin";

export const pluginManifest = definePlugin({
  displayName: "Example: Notification Layer",
  contributes: {
    layerSurfaces: [
      {
        id: "example-notification-1",
        component: "NotificationSurface",
        layer: "notification",
        anchor: 9,
        size: {
          width: 320,
          height: 80,
        },
        margin: {
          top: 16,
          right: 16,
        },
        inputBehavior: "opaque",
        keyboardInteractivity: "none",
        autoStack: {
          direction: "down",
          gap: 8,
        },
        order: 0,
      },
      {
        id: "example-notification-2",
        component: "NotificationSurface",
        layer: "notification",
        anchor: 9,
        size: {
          width: 320,
          height: 80,
        },
        margin: {
          top: 16,
          right: 16,
        },
        inputBehavior: "opaque",
        keyboardInteractivity: "none",
        autoStack: {
          direction: "down",
          gap: 8,
        },
        order: 1,
      },
      {
        id: "example-notification-3",
        component: "NotificationSurface",
        layer: "notification",
        anchor: 9,
        size: {
          width: 320,
          height: 80,
        },
        margin: {
          top: 16,
          right: 16,
        },
        inputBehavior: "opaque",
        keyboardInteractivity: "none",
        autoStack: {
          direction: "down",
          gap: 8,
        },
        order: 2,
      },
    ],
  },
});
