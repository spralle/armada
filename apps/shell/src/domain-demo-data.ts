export interface UnplannedOrder {
  id: string;
  reference: string;
  cargoType: "trailer" | "car" | "mafi";
  destination: string;
  vesselId: string;
}

export interface VesselViewModel {
  id: string;
  name: string;
  vesselClass: "RORO" | "ROPAX";
  route: string;
}

export const demoVessels: readonly VesselViewModel[] = [
  {
    id: "vessel-baltic-star",
    name: "Baltic Star",
    vesselClass: "RORO",
    route: "Trelleborg ↔ Travemünde",
  },
  {
    id: "vessel-nordic-wave",
    name: "Nordic Wave",
    vesselClass: "ROPAX",
    route: "Karlskrona ↔ Gdynia",
  },
  {
    id: "vessel-aurora-link",
    name: "Aurora Link",
    vesselClass: "RORO",
    route: "Halmstad ↔ Rostock",
  },
];

export const demoUnplannedOrders: readonly UnplannedOrder[] = [
  {
    id: "uo-1001",
    reference: "UO-1001",
    cargoType: "trailer",
    destination: "Travemünde",
    vesselId: "vessel-baltic-star",
  },
  {
    id: "uo-1002",
    reference: "UO-1002",
    cargoType: "car",
    destination: "Gdynia",
    vesselId: "vessel-nordic-wave",
  },
  {
    id: "uo-1003",
    reference: "UO-1003",
    cargoType: "mafi",
    destination: "Rostock",
    vesselId: "vessel-aurora-link",
  },
  {
    id: "uo-1004",
    reference: "UO-1004",
    cargoType: "trailer",
    destination: "Travemünde",
    vesselId: "vessel-baltic-star",
  },
];

export function getOrdersForVessel(vesselId: string): readonly UnplannedOrder[] {
  return demoUnplannedOrders.filter((order) => order.vesselId === vesselId);
}

export function resolveOrder(orderId: string): UnplannedOrder | null {
  return demoUnplannedOrders.find((order) => order.id === orderId) ?? null;
}

export function resolveVessel(vesselId: string): VesselViewModel | null {
  return demoVessels.find((vessel) => vessel.id === vesselId) ?? null;
}
