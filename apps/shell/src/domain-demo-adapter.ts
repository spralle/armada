import type { SelectionSyncEvent } from "./window-bridge.js";
import { readEntityTypeSelection } from "./context-state.js";
import {
  getOrdersForVessel,
  resolveOrder,
  resolveVessel,
  type UnplannedOrder,
  type VesselViewModel,
} from "./domain-demo-data.js";

export const domainDemoAdapter = {
  laneKeys: {
    groupSelection: "domain.selection",
    globalSelection: "shell.selection",
  },
  entityTypes: {
    primary: "order",
    secondary: "vessel",
  },
  actionNames: {
    selectPrimary: "select-order",
    selectSecondary: "select-vessel",
  },
  dataAttributes: {
    primaryEntityId: "orderId",
    secondaryEntityId: "vesselId",
  },
  partIds: {
    primary: "domain.unplanned-orders.part",
    secondary: "domain.vessel-view.part",
  },
  intentTypes: {
    primarySelected: "domain.orders.assign-to-vessel",
    secondarySelected: "domain.vessels.focus-related-order",
  },
} as const;

export interface DemoEntitySelection {
  primaryEntityId: string | null;
  secondaryEntityId: string | null;
}

export function readSelectionFromSyncEvent(event: SelectionSyncEvent): DemoEntitySelection {
  return {
    primaryEntityId: event.selectedOrderId ?? null,
    secondaryEntityId: event.selectedVesselId ?? null,
  };
}

export function toSelectionSyncFields(selection: DemoEntitySelection): Pick<SelectionSyncEvent, "selectedOrderId" | "selectedVesselId"> {
  return {
    selectedOrderId: selection.primaryEntityId,
    selectedVesselId: selection.secondaryEntityId,
  };
}

export function resolveSelectionWritesFromSyncEvent(event: SelectionSyncEvent): Array<{
  entityType: string;
  selectedIds: string[];
  priorityId: string | null;
}> {
  const selection = readSelectionFromSyncEvent(event);
  return [
    {
      entityType: domainDemoAdapter.entityTypes.primary,
      selectedIds: selection.primaryEntityId ? [selection.primaryEntityId] : [],
      priorityId: selection.primaryEntityId,
    },
    {
      entityType: domainDemoAdapter.entityTypes.secondary,
      selectedIds: selection.secondaryEntityId ? [selection.secondaryEntityId] : [],
      priorityId: selection.secondaryEntityId,
    },
  ];
}

export function resolveSelectionFromIntentFacts(intent: { facts?: unknown }): DemoEntitySelection {
  const orderId = intent.facts && typeof intent.facts === "object"
    ? ((intent.facts as { source?: { orderId?: string } }).source?.orderId ?? null)
    : null;
  const vesselId = intent.facts && typeof intent.facts === "object"
    ? ((intent.facts as { target?: { vesselId?: string } }).target?.vesselId ?? null)
    : null;

  return {
    primaryEntityId: orderId,
    secondaryEntityId: vesselId,
  };
}

export function resolvePrimaryEntity(entityId: string): UnplannedOrder | null {
  return resolveOrder(entityId);
}

export function resolveSecondaryEntity(entityId: string): VesselViewModel | null {
  return resolveVessel(entityId);
}

export function buildPrimarySelectionTitle(entity: UnplannedOrder): string {
  return `Order ${entity.reference}`;
}

export function buildSecondarySelectionTitle(entity: VesselViewModel): string {
  return `Vessel ${entity.name}`;
}

export function buildGroupSelectionContextValue(input: DemoEntitySelection): string {
  if (input.primaryEntityId && input.secondaryEntityId) {
    return `order:${input.primaryEntityId}|vessel:${input.secondaryEntityId}`;
  }
  if (input.secondaryEntityId) {
    return `vessel:${input.secondaryEntityId}`;
  }
  return "none";
}

export function inferSourceEntityType(targetEntityType: string): string | null {
  if (targetEntityType === domainDemoAdapter.entityTypes.secondary) {
    return domainDemoAdapter.entityTypes.primary;
  }
  if (targetEntityType === domainDemoAdapter.entityTypes.primary) {
    return domainDemoAdapter.entityTypes.secondary;
  }
  return null;
}

export function resolveDomainPropagationSelection(input: {
  sourceEntityType: string;
  targetEntityType: string;
  sourcePriorityId: string | null;
  state: Parameters<typeof readEntityTypeSelection>[0];
}): { entityType: string; selectedIds: string[]; priorityId: string | null } | null {
  if (!input.sourcePriorityId) {
    return {
      entityType: input.targetEntityType,
      selectedIds: [],
      priorityId: null,
    };
  }

  if (
    input.sourceEntityType === domainDemoAdapter.entityTypes.primary &&
    input.targetEntityType === domainDemoAdapter.entityTypes.secondary
  ) {
    const primaryEntity = resolveOrder(input.sourcePriorityId);
    if (!primaryEntity) {
      return {
        entityType: input.targetEntityType,
        selectedIds: [],
        priorityId: null,
      };
    }

    return {
      entityType: domainDemoAdapter.entityTypes.secondary,
      selectedIds: [primaryEntity.vesselId],
      priorityId: primaryEntity.vesselId,
    };
  }

  if (
    input.sourceEntityType === domainDemoAdapter.entityTypes.secondary &&
    input.targetEntityType === domainDemoAdapter.entityTypes.primary
  ) {
    const primaryIds = getOrdersForVessel(input.sourcePriorityId).map((order) => order.id);
    const previousPriority = readEntityTypeSelection(input.state, domainDemoAdapter.entityTypes.primary).priorityId;
    return {
      entityType: domainDemoAdapter.entityTypes.primary,
      selectedIds: primaryIds,
      priorityId: previousPriority && primaryIds.includes(previousPriority) ? previousPriority : (primaryIds[0] ?? null),
    };
  }

  return null;
}
