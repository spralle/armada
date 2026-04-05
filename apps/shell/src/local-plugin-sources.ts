import type { PluginContract } from "@armada/plugin-contracts";

export type LocalPluginContractLoader = () => Promise<PluginContract>;

const LOCAL_PLUGIN_LOADERS: Readonly<Record<string, LocalPluginContractLoader>> = {
  "com.armada.plugin-starter": async () => ({
    manifest: {
      id: "com.armada.plugin-starter",
      name: "Plugin Starter",
      version: "0.1.0",
    },
    contributes: {
      views: [
        {
          id: "starter.view",
          title: "Starter View",
          component: "StarterView",
        },
      ],
    },
  }),
  "com.armada.sample.contract-consumer": async () => ({
    manifest: {
      id: "com.armada.sample.contract-consumer",
      name: "Sample Contract Consumer",
      version: "0.1.0",
    },
    contributes: {
      views: [
        {
          id: "sample.view",
          title: "Sample View",
          component: "SampleView",
        },
      ],
    },
  }),
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
    },
  }),
};

export function resolveLocalPluginContractLoader(
  pluginId: string,
): LocalPluginContractLoader | null {
  return LOCAL_PLUGIN_LOADERS[pluginId] ?? null;
}
