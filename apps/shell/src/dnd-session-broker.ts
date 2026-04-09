import type { WindowBridge } from "./window-bridge.js";

const DEFAULT_TTL_MS = 60_000;

interface SessionEntry {
  payload: unknown;
  expiresAt: number;
}

export interface DragSessionRef {
  id: string;
}

export interface DragSessionBroker {
  readonly available: boolean;
  create(payload: unknown, ttlMs?: number): DragSessionRef;
  consume(ref: DragSessionRef): unknown | null;
  dispose(): void;
}

export function createDragSessionBroker(
  bridge: WindowBridge,
  windowId: string,
): DragSessionBroker {
  const sessions = new Map<string, SessionEntry>();
  const unsubscribe = bridge.subscribe((event) => {
    if (event.sourceWindowId === windowId) {
      return;
    }

    if (event.type === "dnd-session-upsert") {
      sessions.set(event.id, {
        payload: event.payload,
        expiresAt: event.expiresAt,
      });
      pruneExpired(sessions, Date.now());
      return;
    }

    if (event.type === "dnd-session-delete") {
      sessions.delete(event.id);
    }
  });

  return {
    available: bridge.available,
    create(payload, ttlMs = DEFAULT_TTL_MS) {
      const now = Date.now();
      const id = createSessionId(windowId, now);
      const expiresAt = now + Math.max(1_000, ttlMs);

      sessions.set(id, { payload, expiresAt });
      pruneExpired(sessions, now);

      bridge.publish({
        type: "dnd-session-upsert",
        id,
        payload,
        expiresAt,
        sourceWindowId: windowId,
      });

      return { id };
    },
    consume(ref) {
      const now = Date.now();
      const entry = sessions.get(ref.id);

      if (!entry) {
        return null;
      }

      if (entry.expiresAt < now) {
        sessions.delete(ref.id);
        bridge.publish({
          type: "dnd-session-delete",
          id: ref.id,
          sourceWindowId: windowId,
        });
        return null;
      }

      sessions.delete(ref.id);
      bridge.publish({
        type: "dnd-session-delete",
        id: ref.id,
        sourceWindowId: windowId,
      });
      return entry.payload;
    },
    dispose() {
      unsubscribe();
      sessions.clear();
    },
  };
}

function createSessionId(windowId: string, now: number): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `dnd-${windowId}-${now.toString(36)}-${random}`;
}

function pruneExpired(sessions: Map<string, SessionEntry>, now: number): void {
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(id);
    }
  }
}
