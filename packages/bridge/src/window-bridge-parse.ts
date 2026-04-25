import type {
  ContextSyncEvent,
  DndSessionDeleteEvent,
  DndSessionUpsertEvent,
  PopoutRestoreRequestEvent,
  SelectionSyncEvent,
  SyncAckEvent,
  SyncProbeEvent,
  TabCloseSyncEvent,
  WindowBridgeEvent,
} from "./window-bridge.js";

export function parseBridgeEvent(value: unknown): WindowBridgeEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const event = value as Record<string, unknown>;

  switch (event.type) {
    case "selection": return parseSelectionEvent(event);
    case "context": return parseContextEvent(event);
    case "popout-restore-request": return parsePopoutRestoreEvent(event);
    case "tab-close": return parseTabCloseEvent(event);
    case "dnd-session-upsert": return parseDndSessionUpsertEvent(event);
    case "dnd-session-delete": return parseDndSessionDeleteEvent(event);
    case "sync-probe": return parseSyncProbeEvent(event);
    case "sync-ack": return parseSyncAckEvent(event);
    default: return null;
  }
}

function parseSelectionEvent(event: Record<string, unknown>): SelectionSyncEvent | null {
  const selectedPartId =
    typeof event.selectedPartId === "string"
      ? event.selectedPartId
      : (typeof (event as { selectedPartInstanceId?: unknown }).selectedPartInstanceId === "string"
          ? (event as { selectedPartInstanceId: string }).selectedPartInstanceId
          : null);
  const selectedPartInstanceId =
    typeof (event as { selectedPartInstanceId?: unknown }).selectedPartInstanceId === "string"
      ? (event as { selectedPartInstanceId: string }).selectedPartInstanceId
      : selectedPartId;
  const selectedPartDefinitionId =
    typeof (event as { selectedPartDefinitionId?: unknown }).selectedPartDefinitionId === "string"
      ? (event as { selectedPartDefinitionId: string }).selectedPartDefinitionId
      : (typeof event.selectedPartId === "string" ? event.selectedPartId : undefined);

  if (
    typeof selectedPartId === "string" &&
    typeof event.selectedPartTitle === "string" &&
    isSelectionByEntityType(event.selectionByEntityType) &&
    isOptionalRevision(event.revision) &&
    typeof event.sourceWindowId === "string"
  ) {
    return {
      ...event,
      selectedPartId,
      selectedPartInstanceId,
      selectedPartDefinitionId,
    } as SelectionSyncEvent;
  }
  return null;
}

function parseContextEvent(event: Record<string, unknown>): ContextSyncEvent | null {
  const tabId =
    typeof event.tabId === "string"
      ? event.tabId
      : (typeof (event as { tabInstanceId?: unknown }).tabInstanceId === "string"
          ? (event as { tabInstanceId: string }).tabInstanceId
          : undefined);
  const tabInstanceId =
    typeof (event as { tabInstanceId?: unknown }).tabInstanceId === "string"
      ? (event as { tabInstanceId: string }).tabInstanceId
      : tabId;

  if (
    isOptionalContextScope(event.scope) &&
    isOptionalString(tabId) &&
    isOptionalString(tabInstanceId) &&
    isOptionalString((event as { partInstanceId?: unknown }).partInstanceId) &&
    isOptionalString((event as { partDefinitionId?: unknown }).partDefinitionId) &&
    isOptionalString(event.groupId) &&
    typeof event.contextKey === "string" &&
    typeof event.contextValue === "string" &&
    isOptionalRevision(event.revision) &&
    typeof event.sourceWindowId === "string"
  ) {
    return {
      ...event,
      tabId,
      tabInstanceId,
    } as ContextSyncEvent;
  }
  return null;
}

function parsePopoutRestoreEvent(event: Record<string, unknown>): PopoutRestoreRequestEvent | null {
  const tabId =
    typeof event.tabId === "string"
      ? event.tabId
      : typeof event.partId === "string"
        ? event.partId
        : null;

  if (
    tabId &&
    typeof event.hostWindowId === "string" &&
    typeof event.sourceWindowId === "string"
  ) {
    return {
      type: "popout-restore-request",
      tabId,
      partId: typeof event.partId === "string" ? event.partId : undefined,
      hostWindowId: event.hostWindowId,
      sourceWindowId: event.sourceWindowId,
    } as PopoutRestoreRequestEvent;
  }

  return null;
}

function parseTabCloseEvent(event: Record<string, unknown>): TabCloseSyncEvent | null {
  if (typeof event.tabId === "string" && typeof event.sourceWindowId === "string") {
    return event as unknown as TabCloseSyncEvent;
  }
  return null;
}

function parseDndSessionUpsertEvent(event: Record<string, unknown>): DndSessionUpsertEvent | null {
  if (
    typeof event.id === "string" &&
    typeof event.expiresAt === "number" &&
    isOptionalString((event as { correlationId?: unknown }).correlationId) &&
    isOptionalDndSessionUpsertLifecycle((event as { lifecycle?: unknown }).lifecycle) &&
    isOptionalString((event as { ownerWindowId?: unknown }).ownerWindowId) &&
    isOptionalString((event as { consumedByWindowId?: unknown }).consumedByWindowId) &&
    typeof event.sourceWindowId === "string"
  ) {
    return event as unknown as DndSessionUpsertEvent;
  }
  return null;
}

function parseDndSessionDeleteEvent(event: Record<string, unknown>): DndSessionDeleteEvent | null {
  if (
    typeof event.id === "string"
    && isOptionalString((event as { correlationId?: unknown }).correlationId)
    && isOptionalDndSessionDeleteLifecycle((event as { lifecycle?: unknown }).lifecycle)
    && isOptionalString((event as { ownerWindowId?: unknown }).ownerWindowId)
    && isOptionalString((event as { consumedByWindowId?: unknown }).consumedByWindowId)
    && typeof event.sourceWindowId === "string"
  ) {
    return event as unknown as DndSessionDeleteEvent;
  }
  return null;
}

function parseSyncProbeEvent(event: Record<string, unknown>): SyncProbeEvent | null {
  if (typeof event.probeId === "string" && typeof event.sourceWindowId === "string") {
    return event as unknown as SyncProbeEvent;
  }
  return null;
}

function parseSyncAckEvent(event: Record<string, unknown>): SyncAckEvent | null {
  if (
    typeof event.probeId === "string" &&
    typeof event.targetWindowId === "string" &&
    typeof event.sourceWindowId === "string"
  ) {
    return event as unknown as SyncAckEvent;
  }
  return null;
}

function isSelectionByEntityType(
  value: unknown,
): value is Record<string, { selectedIds: string[]; priorityId?: string | null }> {
  if (!value || typeof value !== "object") {
    return false;
  }

  for (const raw of Object.values(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") {
      return false;
    }

    const selection = raw as { selectedIds?: unknown; priorityId?: unknown };
    if (!Array.isArray(selection.selectedIds)) {
      return false;
    }

    const idsAreStrings = selection.selectedIds.every((item) => typeof item === "string");
    if (!idsAreStrings) {
      return false;
    }

    const priority = selection.priorityId;
    if (priority !== undefined && priority !== null && typeof priority !== "string") {
      return false;
    }
  }

  return true;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalContextScope(value: unknown): value is "group" | "global" | undefined {
  return value === undefined || value === "group" || value === "global";
}

function isOptionalDndSessionUpsertLifecycle(value: unknown): value is "start" | "consume" | undefined {
  return value === undefined || value === "start" || value === "consume";
}

function isOptionalDndSessionDeleteLifecycle(value: unknown): value is "commit" | "abort" | "timeout" | undefined {
  return value === undefined || value === "commit" || value === "abort" || value === "timeout";
}

function isOptionalRevision(
  value: unknown,
): value is { timestamp: number; writer: string } | undefined {
  if (value === undefined) {
    return true;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const revision = value as { timestamp?: unknown; writer?: unknown };
  return typeof revision.timestamp === "number" && typeof revision.writer === "string";
}

