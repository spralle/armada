import type { BridgeQuery, BridgeResult } from "@ghost/entity-bridge-contracts";
import type {
  BridgeQueryResponseEvent,
  WindowBridgeEvent,
} from "../window-bridge.js";

export interface PendingQuery {
  queryId: string;
  bridgeId: string;
  resolve: (result: BridgeResult) => void;
  reject: (error: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

export interface CrossWindowCorrelator {
  /** Send a query to a remote window and return a promise for the result */
  sendQuery(
    bridgeId: string,
    query: BridgeQuery,
    targetWindowId: string,
    publish: (event: WindowBridgeEvent) => boolean,
    sourceWindowId: string,
    timeoutMs?: number,
  ): Promise<BridgeResult>;

  /** Handle an incoming response (called from bridge event handler) */
  handleResponse(event: BridgeQueryResponseEvent): boolean;

  /** Get count of pending queries */
  pendingCount(): number;

  /** Cancel all pending queries */
  dispose(): void;
}

const DEFAULT_TIMEOUT_MS = 5000;

let globalCounter = 0;

function defaultCreateId(): string {
  globalCounter += 1;
  return `bq-${Date.now()}-${globalCounter}`;
}

export function createCrossWindowCorrelator(options?: {
  defaultTimeoutMs?: number;
  createId?: () => string;
}): CrossWindowCorrelator {
  const timeoutMs = options?.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const createId = options?.createId ?? defaultCreateId;
  const pending = new Map<string, PendingQuery>();

  return {
    sendQuery(
      bridgeId: string,
      query: BridgeQuery,
      targetWindowId: string,
      publish: (event: WindowBridgeEvent) => boolean,
      sourceWindowId: string,
      overrideTimeoutMs?: number,
    ): Promise<BridgeResult> {
      const queryId = createId();
      const effectiveTimeout = overrideTimeoutMs ?? timeoutMs;

      return new Promise<BridgeResult>((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
          pending.delete(queryId);
          reject(
            new Error(
              `Bridge query timed out: ${bridgeId} (queryId: ${queryId})`,
            ),
          );
        }, effectiveTimeout);

        const entry: PendingQuery = {
          queryId,
          bridgeId,
          resolve,
          reject,
          timeoutHandle,
        };

        pending.set(queryId, entry);

        publish({
          type: "bridge-query-request",
          queryId,
          bridgeId,
          query,
          targetWindowId,
          sourceWindowId,
        });
      });
    },

    handleResponse(event: BridgeQueryResponseEvent): boolean {
      const entry = pending.get(event.queryId);
      if (!entry) {
        return false;
      }

      pending.delete(event.queryId);
      clearTimeout(entry.timeoutHandle);

      if (event.error) {
        entry.reject(new Error(event.error));
      } else {
        entry.resolve(event.result);
      }

      return true;
    },

    pendingCount(): number {
      return pending.size;
    },

    dispose(): void {
      for (const entry of pending.values()) {
        clearTimeout(entry.timeoutHandle);
        entry.reject(new Error("disposed"));
      }
      pending.clear();
    },
  };
}
