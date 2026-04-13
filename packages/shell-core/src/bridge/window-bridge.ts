import { parseBridgeEvent } from "./window-bridge-parse.js";

export interface SelectionSyncEvent {
  type: "selection";
  selectedPartInstanceId?: string;
  selectedPartDefinitionId?: string;
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
  tabInstanceId?: string;
  partInstanceId?: string;
  partDefinitionId?: string;
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
  tabId: string;
  partId?: string;
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
  correlationId?: string;
  lifecycle?: "start" | "consume";
  ownerWindowId?: string;
  consumedByWindowId?: string;
  sourceWindowId: string;
}

export interface DndSessionDeleteEvent {
  type: "dnd-session-delete";
  id: string;
  correlationId?: string;
  lifecycle?: "commit" | "abort" | "timeout";
  ownerWindowId?: string;
  consumedByWindowId?: string;
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
  close(): void;
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
    close() {
      listeners.clear();
      healthListeners.clear();
      channel.close();
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
    close() {
      // no-op fallback
    },
  };
}
