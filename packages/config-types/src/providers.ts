import type { ConfigurationLayer, ConfigurationLayerData } from "./types.js";

export interface WriteResult {
  success: boolean;
  error?: string | undefined;
  revision?: string | undefined;
}

export interface ConfigurationChange {
  key: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ConfigurationStorageProvider {
  readonly id: string;
  readonly layer: ConfigurationLayer | string;
  readonly writable: boolean;
  load(): Promise<ConfigurationLayerData>;
  write(key: string, value: unknown): Promise<WriteResult>;
  remove(key: string): Promise<WriteResult>;
  onExternalChange?(listener: (changes: ConfigurationChange[]) => void): () => void;
}

export type SyncStatus =
  | { status: "synced"; lastSyncedAt: number }
  | { status: "syncing" }
  | { status: "offline"; lastSyncedAt: number; pendingWriteCount: number }
  | { status: "conflict"; conflicts: ConfigurationConflict[] }
  | { status: "error"; error: string; lastSyncedAt?: number | undefined };

export interface ConfigurationConflict {
  key: string;
  localValue: unknown;
  remoteValue: unknown;
  localRevision: string;
  remoteRevision: string;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: ConfigurationConflict[];
}

export interface SyncCursor {
  /**
   * Authoritative server revision token.
   */
  serverRevision: string;
  /**
   * Server-side clock (epoch ms) associated with this cursor.
   */
  serverTime: number;
  /**
   * Optional transport-specific token for feed resume.
   */
  feedToken?: string | undefined;
}

export interface SyncQueueMetadata {
  tenantId: string;
  pendingCount: number;
  inFlightCount: number;
  oldestQueuedAt?: number | undefined;
  newestQueuedAt?: number | undefined;
}

export type SyncMutationOperation = "set" | "remove";

export interface SyncMutationMetadata {
  queuedAt: number;
  attemptCount: number;
  lastAttemptAt?: number | undefined;
  policyAllowed: boolean;
}

export interface SyncQueuedMutation {
  mutationId: string;
  tenantId: string;
  key: string;
  operation: SyncMutationOperation;
  value?: unknown;
  baseRevision?: string | undefined;
  metadata: SyncMutationMetadata;
}

export interface SyncRemoteChange {
  key: string;
  value?: unknown;
  operation: SyncMutationOperation;
  revision: string;
  serverTime: number;
}

export type SyncErrorCode =
  | "network"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "conflict"
  | "rate-limited"
  | "server"
  | "unknown";

export interface SyncErrorMetadata {
  code: SyncErrorCode;
  message: string;
  retryable: boolean;
  status?: number | undefined;
  key?: string | undefined;
  mutationId?: string | undefined;
  serverTime?: number | undefined;
  details?: Readonly<Record<string, unknown>> | undefined;
}

export interface SyncConflictMetadata {
  key: string;
  mutationId?: string | undefined;
  localRevision?: string | undefined;
  serverRevision: string;
  localValue?: unknown;
  serverValue?: unknown;
  serverTime: number;
}

export interface ConfigSyncPullRequest {
  tenantId: string;
  cursor?: SyncCursor | undefined;
  limit?: number | undefined;
}

export interface ConfigSyncPullResponse {
  tenantId: string;
  cursor: SyncCursor;
  serverTime: number;
  changes: ReadonlyArray<SyncRemoteChange>;
}

export interface ConfigSyncPushRequest {
  tenantId: string;
  requestId: string;
  mutations: ReadonlyArray<SyncQueuedMutation>;
}

export interface ConfigSyncPushResult {
  mutationId: string;
  accepted: boolean;
  revision?: string | undefined;
  conflict?: SyncConflictMetadata | undefined;
  error?: SyncErrorMetadata | undefined;
}

export interface ConfigSyncPushResponse {
  tenantId: string;
  requestId: string;
  serverRevision: string;
  serverTime: number;
  results: ReadonlyArray<ConfigSyncPushResult>;
}

export interface ConfigSyncAckRequest {
  tenantId: string;
  requestId: string;
}

export interface ConfigSyncAckResponse {
  tenantId: string;
  requestId: string;
  acked: boolean;
  serverRevision: string;
  serverTime: number;
}

export interface ConfigSyncFeedSubscriptionRequest {
  tenantId: string;
  cursor?: SyncCursor | undefined;
}

export type ConfigSyncFeedEvent =
  | { type: "ready"; cursor: SyncCursor; serverTime: number }
  | { type: "change"; change: SyncRemoteChange }
  | { type: "error"; error: SyncErrorMetadata }
  | { type: "closed"; reason?: string | undefined };

export interface DurableConfigCache {
  loadSnapshot(tenantId: string): Promise<ConfigurationLayerData>;
  saveSnapshot(tenantId: string, data: ConfigurationLayerData): Promise<void>;
  getCursor(tenantId: string): Promise<SyncCursor | undefined>;
  setCursor(tenantId: string, cursor: SyncCursor): Promise<void>;
  enqueueMutation(tenantId: string, mutation: SyncQueuedMutation): Promise<void>;
  peekQueuedMutations(tenantId: string, limit: number): Promise<ReadonlyArray<SyncQueuedMutation>>;
  markRequestInFlight(tenantId: string, requestId: string, mutationIds: ReadonlyArray<string>): Promise<void>;
  acknowledgeRequest(tenantId: string, requestId: string): Promise<void>;
  releaseRequest(tenantId: string, requestId: string, error: SyncErrorMetadata): Promise<void>;
  getQueueMetadata(tenantId: string): Promise<SyncQueueMetadata>;
}

export interface ConfigSyncTransport {
  pull(request: ConfigSyncPullRequest): Promise<ConfigSyncPullResponse>;
  push(request: ConfigSyncPushRequest): Promise<ConfigSyncPushResponse>;
  ack(request: ConfigSyncAckRequest): Promise<ConfigSyncAckResponse>;
  subscribeToFeed?(
    request: ConfigSyncFeedSubscriptionRequest,
    onEvent: (event: ConfigSyncFeedEvent) => void,
  ): Promise<() => void> | (() => void);
}

export interface SyncableStorageProvider extends ConfigurationStorageProvider {
  readonly syncState: SyncStatus;
  readonly pendingWrites: ReadonlyMap<string, unknown>;
  sync(): Promise<SyncResult>;
  onSyncStateChange(listener: (state: SyncStatus) => void): () => void;
}
