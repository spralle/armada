import type { WindowBridge } from "./window-bridge.js";

const DEFAULT_TTL_MS = 60_000;

interface SessionEntry {
  payload: unknown;
  expiresAt: number;
  owned: boolean;
  timeout: ReturnType<typeof setTimeout>;
}

export interface DragSessionRef {
  id: string;
}

export interface DragSessionBroker {
  readonly available: boolean;
  create(payload: unknown, ttlMs?: number): DragSessionRef | null;
  consume(ref: DragSessionRef): unknown | null;
  dispose(): void;
}

export function createDragSessionBroker(
  bridge: WindowBridge,
  windowId: string,
  options?: {
    isDegraded?: () => boolean;
  },
): DragSessionBroker {
  const isDegraded = options?.isDegraded ?? (() => false);
  const sessions = new Map<string, SessionEntry>();
  let disposed = false;

  const scheduleExpiry = (id: string, expiresAt: number): ReturnType<typeof setTimeout> => {
    const delayMs = Math.max(0, expiresAt - Date.now());
    return setTimeout(() => {
      pruneExpired(sessions, Date.now(), publishDelete);
      const entry = sessions.get(id);
      if (!entry) {
        return;
      }

      if (entry.expiresAt >= Date.now()) {
        return;
      }

      sessions.delete(id);
      clearTimeout(entry.timeout);
      if (entry.owned) {
        publishDelete(id);
      }
    }, delayMs);
  };

  const publishDelete = (id: string, options?: { allowWhenDisposed?: boolean }): void => {
    if ((disposed && !options?.allowWhenDisposed) || !bridge.available) {
      return;
    }

    bridge.publish({
      type: "dnd-session-delete",
      id,
      sourceWindowId: windowId,
    });
  };

  const unsubscribe = bridge.subscribe((event) => {
    if (disposed) {
      return;
    }

    if (event.sourceWindowId === windowId) {
      return;
    }

    if (event.type === "dnd-session-upsert") {
      const existing = sessions.get(event.id);
      if (existing) {
        clearTimeout(existing.timeout);
      }

      sessions.set(event.id, {
        payload: event.payload,
        expiresAt: event.expiresAt,
        owned: false,
        timeout: scheduleExpiry(event.id, event.expiresAt),
      });
      pruneExpired(sessions, Date.now(), publishDelete);
      return;
    }

    if (event.type === "dnd-session-delete") {
      const existing = sessions.get(event.id);
      if (existing) {
        clearTimeout(existing.timeout);
      }
      sessions.delete(event.id);
    }
  });

  const isAvailable = (): boolean => bridge.available && !isDegraded();

  return {
    get available() {
      return isAvailable();
    },
    create(payload, ttlMs = DEFAULT_TTL_MS) {
      if (!isAvailable() || disposed) {
        return null;
      }

      const now = Date.now();
      const id = createSessionId(windowId, now);
      const expiresAt = now + Math.max(1_000, ttlMs);
      const timeout = scheduleExpiry(id, expiresAt);

      sessions.set(id, {
        payload,
        expiresAt,
        owned: true,
        timeout,
      });
      pruneExpired(sessions, now, publishDelete);

      const published = bridge.publish({
        type: "dnd-session-upsert",
        id,
        payload,
        expiresAt,
        sourceWindowId: windowId,
      });

      if (!published) {
        const existing = sessions.get(id);
        if (existing) {
          clearTimeout(existing.timeout);
        }
        sessions.delete(id);
        return null;
      }

      return { id };
    },
    consume(ref) {
      if (disposed) {
        return null;
      }

      const now = Date.now();
      pruneExpired(sessions, now, publishDelete);
      const entry = sessions.get(ref.id);

      if (!entry) {
        return null;
      }

      clearTimeout(entry.timeout);

      if (entry.expiresAt < now) {
        sessions.delete(ref.id);
        if (entry.owned) {
          publishDelete(ref.id);
        }
        return null;
      }

      sessions.delete(ref.id);
      publishDelete(ref.id);
      return entry.payload;
    },
    dispose() {
      if (disposed) {
        return;
      }

      unsubscribe();
      for (const [id, entry] of sessions.entries()) {
        clearTimeout(entry.timeout);
        if (entry.owned) {
          publishDelete(id, { allowWhenDisposed: true });
        }
      }
      sessions.clear();
      disposed = true;
    },
  };
}

function createSessionId(windowId: string, now: number): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `dnd-${windowId}-${now.toString(36)}-${random}`;
}

function pruneExpired(
  sessions: Map<string, SessionEntry>,
  now: number,
  publishDelete: (id: string) => void,
): void {
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      clearTimeout(session.timeout);
      sessions.delete(id);
      if (session.owned) {
        publishDelete(id);
      }
    }
  }
}
