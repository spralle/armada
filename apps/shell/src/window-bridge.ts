export interface SelectionSyncEvent {
  type: "selection";
  selectedPartId: string;
  selectedPartTitle: string;
  sourceWindowId: string;
}

export interface ContextSyncEvent {
  type: "context";
  contextKey: string;
  contextValue: string;
  sourceWindowId: string;
}

export interface PopoutRestoreRequestEvent {
  type: "popout-restore-request";
  partId: string;
  hostWindowId: string;
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

export type WindowBridgeEvent =
  | SelectionSyncEvent
  | ContextSyncEvent
  | PopoutRestoreRequestEvent
  | DndSessionUpsertEvent
  | DndSessionDeleteEvent;

export interface WindowBridge {
  readonly available: boolean;
  publish(event: WindowBridgeEvent): void;
  subscribe(listener: (event: WindowBridgeEvent) => void): () => void;
}

export function createWindowBridge(channelName: string): WindowBridge {
  if (typeof BroadcastChannel === "undefined") {
    return createUnavailableBridge();
  }

  const channel = new BroadcastChannel(channelName);
  const listeners = new Set<(event: WindowBridgeEvent) => void>();

  channel.addEventListener("message", (messageEvent: MessageEvent<unknown>) => {
    const event = parseBridgeEvent(messageEvent.data);
    if (!event) {
      return;
    }

    for (const listener of listeners) {
      listener(event);
    }
  });

  return {
    available: true,
    publish(event) {
      channel.postMessage(event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function createUnavailableBridge(): WindowBridge {
  return {
    available: false,
    publish() {
      // no-op fallback
    },
    subscribe() {
      return () => {
        // no-op fallback
      };
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
      typeof event.sourceWindowId === "string"
    ) {
      return event as SelectionSyncEvent;
    }
    return null;
  }

  if (event.type === "context") {
    if (
      typeof event.contextKey === "string" &&
      typeof event.contextValue === "string" &&
      typeof event.sourceWindowId === "string"
    ) {
      return event as ContextSyncEvent;
    }
    return null;
  }

  if (event.type === "popout-restore-request") {
    if (
      typeof event.partId === "string" &&
      typeof event.hostWindowId === "string" &&
      typeof event.sourceWindowId === "string"
    ) {
      return event as PopoutRestoreRequestEvent;
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

  return null;
}
