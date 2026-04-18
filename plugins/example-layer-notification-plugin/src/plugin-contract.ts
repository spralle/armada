import type { PluginContract } from "@ghost/plugin-contracts";
import { AnchorEdge, InputBehavior, KeyboardInteractivity } from "@ghost/plugin-contracts";

/**
 * Notification layer example — auto-stacking corner notifications.
 *
 * Demonstrates: notification layer, top-right corner anchor, auto-stacking
 * with gap, multiple surfaces, timed auto-dismiss.
 */
const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.example-layer-notification",
    name: "Example: Notification Layer",
    version: "0.0.1",
  },
  contributes: {
    layerSurfaces: [
      {
        id: "example-notification-1",
        component: "NotificationSurface",
        layer: "notification",
        anchor: AnchorEdge.Top | AnchorEdge.Right,
        size: { width: 320, height: 80 },
        margin: { top: 16, right: 16 },
        inputBehavior: InputBehavior.Opaque,
        keyboardInteractivity: KeyboardInteractivity.None,
        autoStack: { direction: "down", gap: 8 },
        order: 0,
      },
      {
        id: "example-notification-2",
        component: "NotificationSurface",
        layer: "notification",
        anchor: AnchorEdge.Top | AnchorEdge.Right,
        size: { width: 320, height: 80 },
        margin: { top: 16, right: 16 },
        inputBehavior: InputBehavior.Opaque,
        keyboardInteractivity: KeyboardInteractivity.None,
        autoStack: { direction: "down", gap: 8 },
        order: 1,
      },
      {
        id: "example-notification-3",
        component: "NotificationSurface",
        layer: "notification",
        anchor: AnchorEdge.Top | AnchorEdge.Right,
        size: { width: 320, height: 80 },
        margin: { top: 16, right: 16 },
        inputBehavior: InputBehavior.Opaque,
        keyboardInteractivity: KeyboardInteractivity.None,
        autoStack: { direction: "down", gap: 8 },
        order: 2,
      },
    ],
  },
};

export default pluginContract;
