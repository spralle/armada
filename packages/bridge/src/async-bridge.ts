import type {
  WindowBridge,
  WindowBridgeEvent,
  WindowBridgeHealth,
} from "./window-bridge.js";

export type AsyncWindowBridgeRejectReason =
  | "unavailable"
  | "channel-error"
  | "publish-failed"
  | "timeout"
  | "closed";

export type AsyncWindowBridgePublishResult =
  | {
    status: "accepted";
    disposition: "enqueued";
  }
  | {
    status: "rejected";
    reason: AsyncWindowBridgeRejectReason;
  };

export interface AsyncWindowBridgeHealth {
  sequence: number;
  state: "healthy" | "degraded" | "unavailable";
  reason: AsyncWindowBridgeRejectReason | null;
}

export interface AsyncWindowBridgePublishOptions {
  timeoutMs?: number;
}

/**
 * Transport-agnostic async shell bridge contract.
 *
 * Contract invariants:
 * - publish resolves to accepted/enqueued or rejected with machine-readable reason.
 * - subscribeHealth emits deterministic snapshots with monotonic sequence values.
 * - Same-window docking topology mutation stays outside this boundary.
 */
export interface AsyncWindowBridge {
  readonly available: boolean;
  publish(
    event: WindowBridgeEvent,
    options?: AsyncWindowBridgePublishOptions,
  ): Promise<AsyncWindowBridgePublishResult>;
  subscribe(listener: (event: WindowBridgeEvent) => void): () => void;
  subscribeHealth(listener: (health: AsyncWindowBridgeHealth) => void): () => void;
  recover(): Promise<void>;
  close(): void;
}

export function createAsyncWindowBridgeCompatibilityShim(
  bridge: WindowBridge,
): AsyncWindowBridge {
  const eventListeners = new Set<(event: WindowBridgeEvent) => void>();
  const healthListeners = new Set<(health: AsyncWindowBridgeHealth) => void>();
  let closed = false;
  let sequence = 0;
  let latestHealth = toAsyncWindowBridgeHealth({
    degraded: !bridge.available,
    reason: bridge.available ? null : "unavailable",
  }, ++sequence);

  const notifyHealth = (health: WindowBridgeHealth): void => {
    const next = toAsyncWindowBridgeHealth(health, sequence + 1);
    if (next.state === latestHealth.state && next.reason === latestHealth.reason) {
      return;
    }

    sequence = next.sequence;
    latestHealth = next;
    for (const listener of healthListeners) {
      listener(latestHealth);
    }
  };

  const unsubscribeEvents = bridge.subscribe((event) => {
    if (closed) {
      return;
    }

    for (const listener of eventListeners) {
      listener(event);
    }
  });

  const unsubscribeHealth = bridge.subscribeHealth((health) => {
    if (closed) {
      return;
    }

    notifyHealth(health);
  });

  return {
    available: bridge.available,
    async publish(event, options) {
      if (closed) {
        return {
          status: "rejected",
          reason: "closed",
        };
      }

      if (isTimedOut(options?.timeoutMs)) {
        return {
          status: "rejected",
          reason: "timeout",
        };
      }

      const accepted = bridge.publish(event);
      if (accepted) {
        return {
          status: "accepted",
          disposition: "enqueued",
        };
      }

      return {
        status: "rejected",
        reason: normalizePublishRejectReasonFromShimState(latestHealth.reason, bridge.available),
      };
    },
    subscribe(listener) {
      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    },
    subscribeHealth(listener) {
      healthListeners.add(listener);
      listener(latestHealth);
      return () => {
        healthListeners.delete(listener);
      };
    },
    async recover() {
      if (closed) {
        return;
      }

      bridge.recover();
    },
    close() {
      if (closed) {
        return;
      }

      closed = true;
      unsubscribeEvents();
      unsubscribeHealth();
      bridge.close();
      eventListeners.clear();
      healthListeners.clear();
    },
  };
}

export function normalizeBridgePublishRejectionReason(
  reason: WindowBridgeHealth["reason"] | AsyncWindowBridgeRejectReason | null,
  available: boolean,
): AsyncWindowBridgeRejectReason {
  if (!available || reason === "unavailable") {
    return "unavailable";
  }

  if (reason === "timeout") {
    return "timeout";
  }

  if (reason === "closed") {
    return "closed";
  }

  if (reason === "channel-error") {
    return "channel-error";
  }

  return "publish-failed";
}

function isTimedOut(timeoutMs: number | undefined): boolean {
  if (timeoutMs === undefined) {
    return false;
  }

  return timeoutMs <= 0;
}

function normalizePublishRejectReasonFromShimState(
  reason: AsyncWindowBridgeRejectReason | null,
  available: boolean,
): AsyncWindowBridgeRejectReason {
  if (reason === "timeout" || reason === "closed") {
    return reason;
  }

  return normalizeBridgePublishRejectionReason(reason, available);
}

function toAsyncWindowBridgeHealth(
  health: WindowBridgeHealth,
  sequence: number,
): AsyncWindowBridgeHealth {
  if (health.reason === "unavailable") {
    return {
      sequence,
      state: "unavailable",
      reason: "unavailable",
    };
  }

  if (health.degraded) {
    return {
      sequence,
      state: "degraded",
      reason: normalizeBridgePublishRejectionReason(health.reason, true),
    };
  }

  return {
    sequence,
    state: "healthy",
    reason: null,
  };
}
