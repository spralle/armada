export interface SelectionSyncEvent {
  type: "selection";
  selectedPartId: string;
  selectedPartTitle: string;
  selectionByEntityType: Record<string, {
    selectedIds: string[];
    priorityId?: string | null;
  }>;
  revision?: {
    timestamp: number;
    writer: string;
  };
  sourceWindowId: string;
}

export interface ContextSyncEvent {
  type: "context";
  scope?: "group" | "global";
  tabId?: string;
  groupId?: string;
  contextKey: string;
  contextValue: string;
  revision?: {
    timestamp: number;
    writer: string;
  };
  sourceWindowId: string;
}

export interface PopoutRestoreRequestEvent {
  type: "popout-restore-request";
  tabId?: string;
  partId: string;
  hostWindowId: string;
  sourceWindowId: string;
}

export interface TabCloseSyncEvent {
  type: "tab-close";
  tabId: string;
  sourceWindowId: string;
}

export interface DndSessionUpsertEvent {
  type: "dnd-session-upsert";
  id: string;
  payload: unknown;
  expiresAt: number;
  sourceWindowId: string;
}

export interface DndSessionDeleteEvent {
  type: "dnd-session-delete";
  id: string;
  sourceWindowId: string;
}

export interface SyncProbeEvent {
  type: "sync-probe";
  probeId: string;
  sourceWindowId: string;
}

export interface SyncAckEvent {
  type: "sync-ack";
  probeId: string;
  targetWindowId: string;
  sourceWindowId: string;
}

export interface WindowBridgeHealth {
  degraded: boolean;
  reason: "unavailable" | "channel-error" | "publish-failed" | null;
}

export type WindowBridgeEvent =
  | SelectionSyncEvent
  | ContextSyncEvent
  | PopoutRestoreRequestEvent
  | TabCloseSyncEvent
  | DndSessionUpsertEvent
  | DndSessionDeleteEvent
  | SyncProbeEvent
  | SyncAckEvent;

export interface WindowBridge {
  readonly available: boolean;
  publish(event: WindowBridgeEvent): boolean;
  subscribe(listener: (event: WindowBridgeEvent) => void): () => void;
  subscribeHealth(listener: (health: WindowBridgeHealth) => void): () => void;
  recover(): void;
}

export function createWindowBridge(channelName: string): WindowBridge {
  if (typeof BroadcastChannel === "undefined") {
    return createUnavailableBridge();
  }

  const channel = new BroadcastChannel(channelName);
  const listeners = new Set<(event: WindowBridgeEvent) => void>();
  const healthListeners = new Set<(health: WindowBridgeHealth) => void>();
  let health: WindowBridgeHealth = {
    degraded: false,
    reason: null,
  };

  const setHealth = (next: WindowBridgeHealth) => {
    if (health.degraded === next.degraded && health.reason === next.reason) {
      return;
    }

    health = next;
    for (const listener of healthListeners) {
      listener(health);
    }
  };

  channel.addEventListener("message", (messageEvent: MessageEvent<unknown>) => {
    setHealth({
      degraded: false,
      reason: null,
    });

    const event = parseBridgeEvent(messageEvent.data);
    if (!event) {
      return;
    }

    for (const listener of listeners) {
      listener(event);
    }
  });

  channel.addEventListener("messageerror", () => {
    setHealth({
      degraded: true,
      reason: "channel-error",
    });
  });

  return {
    available: true,
    publish(event) {
      try {
        channel.postMessage(event);
        setHealth({
          degraded: false,
          reason: null,
        });
        return true;
      } catch {
        setHealth({
          degraded: true,
          reason: "publish-failed",
        });
        return false;
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeHealth(listener) {
      healthListeners.add(listener);
      listener(health);
      return () => {
        healthListeners.delete(listener);
      };
    },
    recover() {
      setHealth({
        degraded: false,
        reason: null,
      });
    },
  };
}

function createUnavailableBridge(): WindowBridge {
  const health: WindowBridgeHealth = {
    degraded: true,
    reason: "unavailable",
  };

  return {
    available: false,
    publish() {
      return false;
    },
    subscribe() {
      return () => {
        // no-op fallback
      };
    },
    subscribeHealth(listener) {
      listener(health);
      return () => {
        // no-op fallback
      };
    },
    recover() {
      // unavailable transport cannot recover at runtime
    },
  };
}

function parseBridgeEvent(value: unknown): WindowBridgeEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const event = value as Partial<WindowBridgeEvent>;
  if (event.type === "selection") {
    if (
      typeof event.selectedPartId === "string" &&
      typeof event.selectedPartTitle === "string" &&
      isSelectionByEntityType(event.selectionByEntityType) &&
      isOptionalRevision(event.revision) &&
      typeof event.sourceWindowId === "string"
    ) {
      return event as SelectionSyncEvent;
    }
    return null;
  }

  if (event.type === "context") {
    if (
      isOptionalContextScope(event.scope) &&
      isOptionalString(event.tabId) &&
      isOptionalString(event.groupId) &&
      typeof event.contextKey === "string" &&
      typeof event.contextValue === "string" &&
      isOptionalRevision(event.revision) &&
      typeof event.sourceWindowId === "string"
    ) {
      return event as ContextSyncEvent;
    }
    return null;
  }

  if (event.type === "popout-restore-request") {
    if (
      isOptionalString(event.tabId) &&
      typeof event.partId === "string" &&
      typeof event.hostWindowId === "string" &&
      typeof event.sourceWindowId === "string"
    ) {
      return {
        ...event,
        tabId: event.tabId ?? event.partId,
      } as PopoutRestoreRequestEvent;
    }
    return null;
  }

  if (event.type === "tab-close") {
    if (typeof event.tabId === "string" && typeof event.sourceWindowId === "string") {
      return event as TabCloseSyncEvent;
    }
    return null;
  }

  if (event.type === "dnd-session-upsert") {
    if (
      typeof event.id === "string" &&
      typeof event.expiresAt === "number" &&
      typeof event.sourceWindowId === "string"
    ) {
      return event as DndSessionUpsertEvent;
    }
    return null;
  }

  if (event.type === "dnd-session-delete") {
    if (typeof event.id === "string" && typeof event.sourceWindowId === "string") {
      return event as DndSessionDeleteEvent;
    }
    return null;
  }

  if (event.type === "sync-probe") {
    if (typeof event.probeId === "string" && typeof event.sourceWindowId === "string") {
      return event as SyncProbeEvent;
    }
    return null;
  }

  if (event.type === "sync-ack") {
    if (
      typeof event.probeId === "string" &&
      typeof event.targetWindowId === "string" &&
      typeof event.sourceWindowId === "string"
    ) {
      return event as SyncAckEvent;
    }
    return null;
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
