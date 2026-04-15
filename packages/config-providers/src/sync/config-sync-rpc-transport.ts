import {
  type ConfigSyncAckRequest,
  type ConfigSyncAckResponse,
  type ConfigSyncFeedEvent,
  type ConfigSyncFeedSubscriptionRequest,
  type ConfigSyncPullRequest,
  type ConfigSyncPullResponse,
  type ConfigSyncPushRequest,
  type ConfigSyncPushResponse,
  type ConfigSyncTransport,
  type SyncErrorCode,
  type SyncErrorMetadata,
} from "@ghost/config-types";
import {
  configSyncAckResponseSchema,
  configSyncFeedEventSchema,
  configSyncPullResponseSchema,
  configSyncPushResponseSchema,
} from "./sync-wire-schemas.js";

export interface ConfigSyncRpcClient {
  request<TResponse>(route: string, payload: unknown): Promise<TResponse>;
  subscribe?<TEvent>(
    route: string,
    payload: unknown,
    onEvent: (event: TEvent) => void,
  ): Promise<() => void> | (() => void);
}

export interface ConfigSyncRpcTransportRoutes {
  pull: string;
  push: string;
  ack: string;
  feed?: string;
}

export interface ConfigSyncRpcTransportOptions {
  client: ConfigSyncRpcClient;
  routes?: Partial<ConfigSyncRpcTransportRoutes>;
  classifyError?: (error: unknown) => SyncErrorMetadata;
}

const DEFAULT_ROUTES: ConfigSyncRpcTransportRoutes = {
  pull: "config.sync.pull",
  push: "config.sync.push",
  ack: "config.sync.ack",
  feed: "config.sync.feed",
};

const RETRYABLE_CODES = new Set<SyncErrorCode>(["network", "timeout", "rate-limited", "server"]);
const SYNC_ERROR_CODES = new Set<SyncErrorCode>([
  "network",
  "timeout",
  "unauthorized",
  "forbidden",
  "validation",
  "conflict",
  "rate-limited",
  "server",
  "unknown",
]);

export class ConfigSyncRpcTransportError extends Error {
  readonly syncError: SyncErrorMetadata;

  constructor(syncError: SyncErrorMetadata, cause?: unknown) {
    super(syncError.message);
    this.name = "ConfigSyncRpcTransportError";
    this.syncError = syncError;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export function classifyRpcSyncError(error: unknown): SyncErrorMetadata {
  if (error instanceof ConfigSyncRpcTransportError) {
    return error.syncError;
  }

  if (error instanceof Error && error.name === "ZodError") {
    return {
      code: "validation",
      message: "Invalid RPC sync response payload.",
      retryable: false,
    };
  }

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    retryable?: unknown;
    status?: unknown;
    statusCode?: unknown;
    details?: unknown;
  };

  const status = asNumber(candidate?.status) ?? asNumber(candidate?.statusCode);
  const code = asSyncErrorCode(candidate?.code) ?? "unknown";
  const retryable = typeof candidate?.retryable === "boolean" ? candidate.retryable : RETRYABLE_CODES.has(code);

  return {
    code,
    message: asMessage(candidate?.message),
    retryable,
    status,
    details: asRecord(candidate?.details),
  };
}

export class ConfigSyncRpcTransportAdapter implements ConfigSyncTransport {
  private readonly client: ConfigSyncRpcClient;
  private readonly routes: ConfigSyncRpcTransportRoutes;
  private readonly classifyError: (error: unknown) => SyncErrorMetadata;

  constructor(options: ConfigSyncRpcTransportOptions) {
    this.client = options.client;
    this.routes = { ...DEFAULT_ROUTES, ...options.routes };
    this.classifyError = options.classifyError ?? classifyRpcSyncError;
  }

  async pull(request: ConfigSyncPullRequest): Promise<ConfigSyncPullResponse> {
    return this.request(this.routes.pull, request, configSyncPullResponseSchema.parse);
  }

  async push(request: ConfigSyncPushRequest): Promise<ConfigSyncPushResponse> {
    return this.request(this.routes.push, request, configSyncPushResponseSchema.parse);
  }

  async ack(request: ConfigSyncAckRequest): Promise<ConfigSyncAckResponse> {
    return this.request(this.routes.ack, request, configSyncAckResponseSchema.parse);
  }

  subscribeToFeed(
    request: ConfigSyncFeedSubscriptionRequest,
    onEvent: (event: ConfigSyncFeedEvent) => void,
  ): Promise<() => void> | (() => void) {
    if (this.routes.feed === undefined || this.client.subscribe === undefined) {
      return () => {};
    }

    try {
      const subscription = this.client.subscribe(this.routes.feed, request, (event) => {
        onEvent(configSyncFeedEventSchema.parse(event));
      });

      if (subscription instanceof Promise) {
        return subscription.catch((error: unknown) => {
          throw this.wrapError(error);
        });
      }

      return subscription;
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  private async request<TResponse>(
    route: string,
    requestPayload: unknown,
    parse: (payload: unknown) => TResponse,
  ): Promise<TResponse> {
    try {
      const response = await this.client.request(route, requestPayload);
      return parse(response);
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  private wrapError(error: unknown): ConfigSyncRpcTransportError {
    return new ConfigSyncRpcTransportError(this.classifyError(error), error);
  }
}

function asSyncErrorCode(value: unknown): SyncErrorCode | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return SYNC_ERROR_CODES.has(value as SyncErrorCode) ? (value as SyncErrorCode) : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function asMessage(value: unknown): string {
  return typeof value === "string" && value.length > 0
    ? value
    : "RPC config sync transport request failed.";
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}
