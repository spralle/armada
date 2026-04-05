import type { ShellSlot } from "./layout.js";
import {
  demoUnplannedOrders,
  demoVessels,
  getOrdersForVessel,
} from "./domain-demo-data.js";

export interface LocalMockRenderContext {
  selectedPrimaryEntityId: string | null;
  selectedSecondaryEntityId: string | null;
}

export interface LocalMockPart {
  id: string;
  title: string;
  slot: ShellSlot;
  ownerPluginId?: string;
  alwaysVisible?: boolean;
  render(context: LocalMockRenderContext): string;
}

export const localMockParts: LocalMockPart[] = [
  {
    id: "domain.unplanned-orders.part",
    title: "Unplanned Orders",
    slot: "master",
    ownerPluginId: "com.armada.domain.unplanned-orders",
    render: (context) => {
      const rows = demoUnplannedOrders
        .map((order) => {
          const selectedClass =
            context.selectedPrimaryEntityId === order.id ? "domain-row is-selected" : "domain-row";
          return `<button type="button" class="${selectedClass}" data-action="select-order" data-order-id="${order.id}" data-vessel-id="${order.vesselId}">
            <strong>${order.reference}</strong>
            <span>${order.cargoType.toUpperCase()} · ${order.destination}</span>
          </button>`;
        })
        .join("");

      return `<section class="domain-panel" data-domain-panel="orders">
        <h3>Unplanned orders</h3>
        <p class="domain-hint">Select an order to focus the related vessel.</p>
        <div class="domain-list">${rows}</div>
      </section>`;
    },
  },
  {
    id: "domain.vessel-view.part",
    title: "Vessel View (RORO/ROPAX)",
    slot: "secondary",
    ownerPluginId: "com.armada.domain.vessel-view",
    render: (context) => {
      const rows = demoVessels
        .map((vessel) => {
          const orderCount = getOrdersForVessel(vessel.id).length;
          const selectedClass =
            context.selectedSecondaryEntityId === vessel.id ? "domain-row is-selected" : "domain-row";
          return `<button type="button" class="${selectedClass}" data-action="select-vessel" data-vessel-id="${vessel.id}">
            <strong>${vessel.name}</strong>
            <span>${vessel.vesselClass} · ${vessel.route} · ${orderCount} unplanned</span>
          </button>`;
        })
        .join("");

      return `<section class="domain-panel" data-domain-panel="vessels">
        <h3>Vessel view</h3>
        <p class="domain-hint">Select a vessel to focus matching unplanned orders.</p>
        <div class="domain-list">${rows}</div>
      </section>`;
    },
  },
  {
    id: "workbench.side.navigator",
    title: "Navigator",
    slot: "side",
    alwaysVisible: true,
    render: (context) =>
      `<section>
        <h3>Shared domain context</h3>
        <p>Selected primary entity: ${context.selectedPrimaryEntityId ?? "none"}</p>
        <p>Selected secondary entity: ${context.selectedSecondaryEntityId ?? "none"}</p>
      </section>`,
  },
];
