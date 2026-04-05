import type { PluginContract } from "@armada/plugin-contracts";

export type LocalPluginContractLoader = () => Promise<PluginContract>;

const LOCAL_PLUGIN_LOADERS: Readonly<Record<string, LocalPluginContractLoader>> = {
  "com.armada.domain.unplanned-orders": async () => ({
    manifest: {
      id: "com.armada.domain.unplanned-orders",
      name: "Unplanned Orders",
      version: "0.1.0",
    },
    contributes: {
      views: [
        {
          id: "domain.unplanned-orders.view",
          title: "Unplanned Orders",
          component: "UnplannedOrdersView",
        },
      ],
      parts: [
        {
          id: "domain.unplanned-orders.part",
          title: "Unplanned Orders",
          slot: "main",
          component: "UnplannedOrdersPart",
        },
      ],
      selection: [
        {
          id: "domain.unplanned-orders.selection",
          target: "vessel",
          receiverEntityType: "vessel",
          interests: [
            {
              sourceEntityType: "order",
              adapter: "domain.order-priority-to-vessel",
            },
          ],
        },
      ],
      derivedLanes: [
        {
          id: "domain.unplanned-orders.priority-vessel",
          key: "domain.derived.vessel.priority",
          sourceEntityType: "vessel",
          scope: "group",
          valueType: "entity-id",
          strategy: "priority-id",
        },
      ],
      actions: [
        {
          id: "domain.orders.assign-to-vessel",
          title: "Assign order to selected vessel",
          handler: "assignOrderToVessel",
          intentType: "domain.orders.assign-to-vessel",
          when: {
            sourceType: "order",
            targetType: "vessel",
          },
        },
      ],
      commands: [
        {
          id: "domain.orders.command.focus-selected",
          title: "Orders: Focus Selected Order",
          intent: "orders.focusSelected",
          when: "selection.orderId",
          enablement: "selection.orderId && context.domain.selection",
        },
      ],
      menus: [
        {
          command: "domain.orders.command.focus-selected",
          menu: "sidePanel",
          group: "orders",
          when: "selection.orderId",
        },
      ],
      keybindings: [
        {
          command: "domain.orders.command.focus-selected",
          key: "ctrl+shift+o",
          when: "selection.orderId",
        },
      ],
    },
  }),
  "com.armada.domain.vessel-view": async () => ({
    manifest: {
      id: "com.armada.domain.vessel-view",
      name: "Vessel View (RORO/ROPAX)",
      version: "0.1.0",
    },
    contributes: {
      views: [
        {
          id: "domain.vessel.view",
          title: "Vessel View",
          component: "VesselView",
        },
      ],
      parts: [
        {
          id: "domain.vessel-view.part",
          title: "Vessel View (RORO/ROPAX)",
          slot: "secondary",
          component: "VesselViewPart",
        },
      ],
      selection: [
        {
          id: "domain.vessel.selection",
          target: "order",
          receiverEntityType: "order",
          interests: [
            {
              sourceEntityType: "vessel",
              adapter: "domain.vessel-priority-to-orders",
            },
          ],
        },
      ],
      derivedLanes: [
        {
          id: "domain.vessel.selected-orders",
          key: "domain.derived.order.selected",
          sourceEntityType: "order",
          scope: "group",
          valueType: "entity-id-list",
          strategy: "joined-selected-ids",
        },
      ],
      actions: [
        {
          id: "domain.vessel.assign-roro",
          title: "Assign order to RORO vessel",
          handler: "assignOrderToRoroVessel",
          intentType: "domain.orders.assign-to-vessel",
          when: {
            sourceType: "order",
            targetType: "vessel",
            "target.vesselClass": "RORO",
          },
        },
      ],
      commands: [
        {
          id: "domain.vessel.command.focus-selected",
          title: "Vessel: Focus Selected Vessel",
          intent: "vessel.focusSelected",
          when: "selection.vesselId",
          enablement: "selection.vesselId",
        },
      ],
      menus: [
        {
          command: "domain.vessel.command.focus-selected",
          menu: "sidePanel",
          group: "vessel",
          when: "selection.vesselId",
        },
      ],
      keybindings: [
        {
          command: "domain.vessel.command.focus-selected",
          key: "ctrl+shift+v",
          when: "selection.vesselId",
        },
      ],
    },
  }),
};

export function resolveLocalPluginContractLoader(
  pluginId: string,
): LocalPluginContractLoader | null {
  return LOCAL_PLUGIN_LOADERS[pluginId] ?? null;
}
