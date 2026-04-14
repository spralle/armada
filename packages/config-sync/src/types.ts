import type {
  ConfigurationLayerData,
  ConfigurationConflict,
  DurableConfigCache,
  SyncErrorMetadata,
  SyncQueueMetadata,
  SyncResult,
  SyncStatus,
  SyncableStorageProvider,
  SyncQueuedMutation,
  ConfigSyncTransport,
} from "@ghost/config-types";

export interface SyncRetryPolicy {
  baseDelayMs?: number | undefined;
  maxDelayMs?: number | undefined;
}

export interface ConfigSyncOrchestratorOptions {
  tenantId: string;
  cache: DurableConfigCache;
  transport: ConfigSyncTransport;
  retryPolicy?: SyncRetryPolicy | undefined;
  conflictResolution?: "server-authoritative" | "lww-fallback" | undefined;
  batchSize?: number | undefined;
  now?: (() => number) | undefined;
}

export interface SyncDiagnostics {
  tenantId: string;
  queue: SyncQueueMetadata;
  lastSyncedAt?: number | undefined;
  lastError?: SyncErrorMetadata | undefined;
  retryScheduledAt?: number | undefined;
  retryAttempt: number;
}

export interface ConfigSyncOrchestrator {
  load(): Promise<ConfigurationLayerData>;
  write(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  sync(): Promise<SyncResult>;
  triggerSync(): void;
  setOnline(isOnline: boolean): void;
  getSyncState(): SyncStatus;
  onSyncStateChange(listener: (state: SyncStatus) => void): () => void;
  getDiagnostics(): SyncDiagnostics;
  onDiagnosticsChange(listener: (diagnostics: SyncDiagnostics) => void): () => void;
  getPendingWrites(): ReadonlyMap<string, unknown>;
}

export interface SyncableConfigStorageProvider extends SyncableStorageProvider {
  getSyncDiagnostics(): SyncDiagnostics;
  onSyncDiagnosticsChange(listener: (diagnostics: SyncDiagnostics) => void): () => void;
}

export interface PushCycleResult {
  pushed: number;
  conflicts: ConfigurationConflict[];
}

export interface PushBatchOutcome {
  pushed: number;
  conflicts: ConfigurationConflict[];
  shouldStop: boolean;
  retryableError?: SyncErrorMetadata | undefined;
}

export interface LocalMutationContext {
  mutation: SyncQueuedMutation;
  localValue: unknown;
  localRevision?: string | undefined;
}
