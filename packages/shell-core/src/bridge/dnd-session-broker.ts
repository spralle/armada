import type { WindowBridge } from "./window-bridge.js";
import {
  createCorrelationId,
  finalizeSession,
  logProtocol,
  MIN_TTL_MS,
  pruneExpiredSessions,
  pruneTerminals,
  rememberTerminal,
  type SessionEntry,
} from "./dnd-session-broker-protocol.js";

const DEFAULT_TTL_MS = 60_000;

export interface DragSessionRef {
  id: string;
}

export interface DragSessionBroker {
  readonly available: boolean;
  create(payload: unknown, ttlMs?: number): DragSessionRef | null;
  consume(ref: DragSessionRef, consumedByWindowId?: string): unknown | null;
  commit(ref: DragSessionRef, consumedByWindowId?: string): boolean;
  abort(ref: DragSessionRef, sourceWindowId?: string): boolean;
  pruneExpired(now?: number): number;
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
  const terminalSessions = new Map<string, number>();
  let disposed = false;
  const unsubscribe = bridge.subscribe((event) => {
    if (disposed) {
      return;
    }

    if (event.sourceWindowId === windowId) {
      return;
    }

    if (event.type === "dnd-session-upsert") {
      if (terminalSessions.has(event.id)) {
        logProtocol("ignored-late-start-after-terminal", {
          id: event.id,
          sourceWindowId: event.sourceWindowId,
          lifecycle: event.lifecycle ?? "start",
          correlationId: event.correlationId,
        });
        return;
      }

      const lifecycle = event.lifecycle ?? "start";
      const existing = sessions.get(event.id);
      if (lifecycle === "consume") {
        if (!existing) {
          logProtocol("ignored-late-consume-missing-session", {
            id: event.id,
            sourceWindowId: event.sourceWindowId,
            consumedByWindowId: event.consumedByWindowId,
            correlationId: event.correlationId,
          });
          return;
        }

        if (existing.consumedByWindowId) {
          return;
        }

        sessions.set(event.id, {
          ...existing,
          state: "consume",
          consumedByWindowId: event.consumedByWindowId ?? event.sourceWindowId,
        });
        pruneExpiredSessions(sessions, terminalSessions, Date.now(), windowId, bridge);
        pruneTerminals(terminalSessions, Date.now());
        return;
      }

      if (existing) {
        return;
      }

      sessions.set(event.id, {
        payload: event.payload,
        expiresAt: event.expiresAt,
        correlationId: event.correlationId ?? createCorrelationId(event.sourceWindowId, Date.now()),
        ownerWindowId: event.ownerWindowId ?? event.sourceWindowId,
        consumedByWindowId: null,
        state: "start",
      });
      pruneExpiredSessions(sessions, terminalSessions, Date.now(), windowId, bridge);
      pruneTerminals(terminalSessions, Date.now());
      return;
    }

    if (event.type === "dnd-session-delete") {
      const terminal = event.lifecycle ?? "commit";
      if (!sessions.has(event.id)) {
        logProtocol("ignored-late-terminal-missing-session", {
          id: event.id,
          sourceWindowId: event.sourceWindowId,
          lifecycle: terminal,
          correlationId: event.correlationId,
        });
        rememberTerminal(terminalSessions, event.id, Date.now());
        return;
      }

      sessions.delete(event.id);
      rememberTerminal(terminalSessions, event.id, Date.now());
      pruneTerminals(terminalSessions, Date.now());
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
      const expiresAt = now + Math.max(MIN_TTL_MS, ttlMs);
      const correlationId = createCorrelationId(windowId, now);

      sessions.set(id, {
        payload,
        expiresAt,
        correlationId,
        ownerWindowId: windowId,
        consumedByWindowId: null,
        state: "start",
      });
      pruneExpiredSessions(sessions, terminalSessions, now, windowId, bridge);
      pruneTerminals(terminalSessions, now);

      const published = bridge.publish({
        type: "dnd-session-upsert",
        id,
        payload,
        expiresAt,
        correlationId,
        lifecycle: "start",
        ownerWindowId: windowId,
        sourceWindowId: windowId,
      });

      if (!published) {
        sessions.delete(id);
        return null;
      }

      return { id };
    },
    consume(ref, consumedByWindowId = windowId) {
      if (disposed) {
        return null;
      }

      const now = Date.now();
      pruneExpiredSessions(sessions, terminalSessions, now, windowId, bridge);
      pruneTerminals(terminalSessions, now);

      const entry = sessions.get(ref.id);

      if (!entry) {
        return null;
      }

      if (entry.consumedByWindowId) {
        logProtocol("ignored-duplicate-consume", {
          id: ref.id,
          consumedByWindowId,
          alreadyConsumedByWindowId: entry.consumedByWindowId,
          correlationId: entry.correlationId,
        });
        return null;
      }

      sessions.set(ref.id, {
        ...entry,
        consumedByWindowId,
        state: "consume",
      });

      bridge.publish({
        type: "dnd-session-upsert",
        id: ref.id,
        payload: entry.payload,
        expiresAt: entry.expiresAt,
        correlationId: entry.correlationId,
        lifecycle: "consume",
        ownerWindowId: entry.ownerWindowId,
        consumedByWindowId,
        sourceWindowId: windowId,
      });

      return entry.payload;
    },
    commit(ref, consumedByWindowId = windowId) {
      const now = Date.now();
      pruneExpiredSessions(sessions, terminalSessions, now, windowId, bridge);
      pruneTerminals(terminalSessions, now);

      const entry = sessions.get(ref.id);
      if (!entry) {
        return false;
      }

      if (!entry.consumedByWindowId) {
        logProtocol("ignored-commit-before-consume", {
          id: ref.id,
          consumedByWindowId,
          correlationId: entry.correlationId,
        });
        return false;
      }

      if (entry.consumedByWindowId !== consumedByWindowId) {
        logProtocol("ignored-commit-from-non-consumer", {
          id: ref.id,
          consumedByWindowId,
          expectedConsumedByWindowId: entry.consumedByWindowId,
          correlationId: entry.correlationId,
        });
        return false;
      }

      finalizeSession(sessions, terminalSessions, bridge, windowId, ref.id, entry, "commit", consumedByWindowId);
      return true;
    },
    abort(ref, sourceWindowId = windowId) {
      const now = Date.now();
      pruneExpiredSessions(sessions, terminalSessions, now, windowId, bridge);
      pruneTerminals(terminalSessions, now);

      const entry = sessions.get(ref.id);
      if (!entry) {
        return false;
      }

      if (sourceWindowId !== entry.ownerWindowId && sourceWindowId !== entry.consumedByWindowId) {
        logProtocol("ignored-abort-from-non-owner", {
          id: ref.id,
          sourceWindowId,
          ownerWindowId: entry.ownerWindowId,
          consumedByWindowId: entry.consumedByWindowId,
          correlationId: entry.correlationId,
        });
        return false;
      }

      finalizeSession(
        sessions,
        terminalSessions,
        bridge,
        windowId,
        ref.id,
        entry,
        "abort",
        entry.consumedByWindowId,
      );
      return true;
    },
    pruneExpired(now = Date.now()) {
      return pruneExpiredSessions(sessions, terminalSessions, now, windowId, bridge);
    },
    dispose() {
      if (disposed) {
        return;
      }

      unsubscribe();
      const now = Date.now();
      pruneExpiredSessions(sessions, terminalSessions, now, windowId, bridge);
      const ownedPending = [...sessions.entries()]
        .filter(([, entry]) => entry.ownerWindowId === windowId)
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
      for (const [id, entry] of ownedPending) {
        finalizeSession(sessions, terminalSessions, bridge, windowId, id, entry, "abort", entry.consumedByWindowId);
      }
      sessions.clear();
      terminalSessions.clear();
      disposed = true;
    },
  };
}

function createSessionId(windowId: string, now: number): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `dnd-${windowId}-${now.toString(36)}-${random}`;
}
