import {
  normalizeBridgePublishRejectionReason,
  type AsyncWindowBridge,
  type AsyncWindowBridgeHealth,
  type AsyncWindowBridgeRejectReason,
} from "./app/async-bridge.js";
import type { WindowBridgeEvent } from "./window-bridge.js";
import { parseBridgeEvent } from "./window-bridge-parse.js";

type ScompHealthState = "healthy" | "degraded" | "unavailable";

interface ScompTransport {
  publish(event: unknown): void | Promise<void>;
  subscribe(listener: (event: unknown) => void): () => void;
  subscribeHealth?(listener: (health: unknown) => void): () => void;
  recover?(): void | Promise<void>;
  close?(): void;
  dispose?(): void;
}

export interface CreateAsyncScompWindowBridgeOptions {
  channelName: string;
  loadTransport?: (channelName: string) => Promise<ScompTransport>;
}

const SCOMP_TRANSPORT_SPECIFIER = "@scomp/transport-browser-windows";

export function createAsyncScompWindowBridge(
  options: CreateAsyncScompWindowBridgeOptions,
): AsyncWindowBridge {
  const listeners = new Set<(event: WindowBridgeEvent) => void>();
  const healthListeners = new Set<(health: AsyncWindowBridgeHealth) => void>();
  let closed = false;
  let sequence = 0;
  let latestHealth: AsyncWindowBridgeHealth = {
    sequence: ++sequence,
    state: "healthy",
    reason: null,
  };
  let unsubscribeEvents: (() => void) | null = null;
  let unsubscribeHealth: (() => void) | null = null;
  let activeTransport: ScompTransport | null = null;

  const loadTransport = options.loadTransport ?? loadScompTransport;
  const transportReady = loadTransport(options.channelName)
    .then((transport) => {
      if (closed) {
        closeTransport(transport);
        return null;
      }

      activeTransport = transport;
      unsubscribeEvents = transport.subscribe((rawEvent) => {
        if (closed) {
          return;
        }
        const event = parseBridgeEvent(rawEvent);
        if (!event) {
          return;
        }
        for (const listener of listeners) {
          listener(event);
        }
      });

      unsubscribeHealth = transport.subscribeHealth?.((rawHealth) => {
        if (closed) {
          return;
        }
        setHealth(normalizeScompHealth(rawHealth));
      }) ?? null;

      setHealth({
        state: "healthy",
        reason: null,
      });
      return transport;
    })
    .catch(() => {
      if (!closed) {
        setHealth({
          state: "unavailable",
          reason: "unavailable",
        });
      }
      return null;
    });

  function setHealth(next: {
    state: ScompHealthState;
    reason: AsyncWindowBridgeRejectReason | null;
  }): void {
    if (next.state === latestHealth.state && next.reason === latestHealth.reason) {
      return;
    }

    latestHealth = {
      sequence: ++sequence,
      state: next.state,
      reason: next.reason,
    };
    for (const listener of healthListeners) {
      listener(latestHealth);
    }
  }

  return {
    available: true,
    async publish(event, publishOptions) {
      if (closed) {
        return { status: "rejected", reason: "closed" };
      }
      if (publishOptions?.timeoutMs !== undefined && publishOptions.timeoutMs <= 0) {
        return { status: "rejected", reason: "timeout" };
      }

      try {
        const readyTransport = await withOptionalTimeout(transportReady, publishOptions?.timeoutMs);
        if (!readyTransport || closed) {
          return {
            status: "rejected",
            reason: closed ? "closed" : "unavailable",
          };
        }

        await withOptionalTimeout(Promise.resolve(readyTransport.publish(event)), publishOptions?.timeoutMs);
        setHealth({
          state: "healthy",
          reason: null,
        });
        return {
          status: "accepted",
          disposition: "enqueued",
        };
      } catch (error) {
        const reason = normalizeScompFailureReason(error);
        setHealth({
          state: reason === "unavailable" ? "unavailable" : "degraded",
          reason,
        });
        return {
          status: "rejected",
          reason,
        };
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
      listener(latestHealth);
      return () => {
        healthListeners.delete(listener);
      };
    },
    async recover() {
      if (closed) {
        return;
      }
      const readyTransport = await transportReady;
      if (!readyTransport || closed) {
        return;
      }
      await readyTransport.recover?.();
      setHealth({
        state: "healthy",
        reason: null,
      });
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      unsubscribeEvents?.();
      unsubscribeHealth?.();
      unsubscribeEvents = null;
      unsubscribeHealth = null;
      if (activeTransport) {
        closeTransport(activeTransport);
      }
      activeTransport = null;
      listeners.clear();
      healthListeners.clear();
    },
  };
}

export function normalizeScompFailureReason(error: unknown): AsyncWindowBridgeRejectReason {
  const message = readErrorMessage(error);
  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }
  if (message.includes("closed") || message.includes("disposed")) {
    return "closed";
  }
  if (message.includes("unavailable") || message.includes("not available") || message.includes("unsupported")) {
    return "unavailable";
  }
  if (message.includes("channel") || message.includes("messageerror")) {
    return "channel-error";
  }
  return "publish-failed";
}

function normalizeScompHealth(rawHealth: unknown): {
  state: ScompHealthState;
  reason: AsyncWindowBridgeRejectReason | null;
} {
  const parsed = rawHealth as {
    state?: unknown;
    degraded?: unknown;
    reason?: unknown;
  };

  if (parsed.state === "healthy") {
    return { state: "healthy", reason: null };
  }
  if (parsed.state === "unavailable") {
    return { state: "unavailable", reason: "unavailable" };
  }

  const reason = parseReasonValue(parsed.reason);
  if (reason) {
    return {
      state: reason === "unavailable" ? "unavailable" : "degraded",
      reason,
    };
  }
  if (parsed.degraded === false) {
    return { state: "healthy", reason: null };
  }
  return { state: "degraded", reason: "publish-failed" };
}

function parseReasonValue(value: unknown): AsyncWindowBridgeRejectReason | null {
  if (typeof value !== "string") {
    return null;
  }

  const reason = value.toLowerCase();
  if (reason === "timeout") {
    return "timeout";
  }
  if (reason === "closed") {
    return "closed";
  }

  const normalized = normalizeBridgePublishRejectionReason(
    reason as "unavailable" | "channel-error" | "publish-failed" | null,
    true,
  );
  return normalized;
}

async function loadScompTransport(channelName: string): Promise<ScompTransport> {
  const moduleNamespace = await dynamicImport(SCOMP_TRANSPORT_SPECIFIER);
  const factory = resolveFactory(moduleNamespace as Record<string, unknown>);
  const transport = await Promise.resolve(factory({ channelName }));
  return normalizeTransport(transport as Record<string, unknown>);
}

function resolveFactory(moduleNamespace: Record<string, unknown>): (options: { channelName: string }) => unknown {
  const candidates = [
    moduleNamespace.createBrowserWindowsTransport,
    moduleNamespace.createTransport,
    moduleNamespace.default,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "function") {
      return candidate as (options: { channelName: string }) => unknown;
    }
  }
  throw new Error("SCOMP transport factory was not found.");
}

function normalizeTransport(transport: Record<string, unknown>): ScompTransport {
  if (typeof transport.publish !== "function" || typeof transport.subscribe !== "function") {
    throw new Error("SCOMP transport is missing publish/subscribe methods.");
  }

  return {
    publish: transport.publish.bind(transport) as (event: unknown) => void | Promise<void>,
    subscribe: transport.subscribe.bind(transport) as (listener: (event: unknown) => void) => () => void,
    subscribeHealth: typeof transport.subscribeHealth === "function"
      ? transport.subscribeHealth.bind(transport) as (listener: (health: unknown) => void) => () => void
      : undefined,
    recover: typeof transport.recover === "function"
      ? transport.recover.bind(transport) as () => void | Promise<void>
      : undefined,
    close: typeof transport.close === "function"
      ? transport.close.bind(transport) as () => void
      : undefined,
    dispose: typeof transport.dispose === "function"
      ? transport.dispose.bind(transport) as () => void
      : undefined,
  };
}

function closeTransport(transport: ScompTransport): void {
  transport.close?.();
  transport.dispose?.();
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }
  if (typeof error === "string") {
    return error.toLowerCase();
  }
  return "";
}

const dynamicImport: (specifier: string) => Promise<unknown> =
  Function("specifier", "return import(specifier);") as (specifier: string) => Promise<unknown>;

async function withOptionalTimeout<T>(promise: Promise<T>, timeoutMs: number | undefined): Promise<T> {
  if (timeoutMs === undefined) {
    return promise;
  }
  if (timeoutMs <= 0) {
    throw new Error("timeout");
  }

  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error("timeout"));
      }, timeoutMs);
    }),
  ]);
}
