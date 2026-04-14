import type { ConfigurationLayerData, SyncResult } from "@ghost/config-types";
import {
  classifySyncError,
  cloneSnapshot,
  createMutation,
  flushQueue,
  pullChanges,
} from "./internal/orchestrator-ops.js";
import { DiagnosticsStore } from "./internal/diagnostics-store.js";
import { calculateRetryDelay, scheduleRetryState } from "./internal/retry-policy.js";
import type {
  ConfigSyncOrchestrator,
  ConfigSyncOrchestratorOptions,
  LocalMutationContext,
  SyncDiagnostics,
} from "./types.js";

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_RETRY_BASE_MS = 500;
const DEFAULT_RETRY_MAX_MS = 30_000;

export function createConfigSyncOrchestrator(options: ConfigSyncOrchestratorOptions): ConfigSyncOrchestrator {
  return new ConfigSyncOrchestratorImpl(options);
}

class ConfigSyncOrchestratorImpl implements ConfigSyncOrchestrator {
  private readonly tenantId: string;
  private readonly cache: ConfigSyncOrchestratorOptions["cache"];
  private readonly transport: ConfigSyncOrchestratorOptions["transport"];
  private readonly batchSize: number;
  private readonly retryBaseMs: number;
  private readonly retryMaxMs: number;
  private readonly conflictResolution: "server-authoritative" | "lww-fallback";
  private readonly now: () => number;
  private readonly store: DiagnosticsStore;
  private readonly pendingWrites = new Map<string, unknown>();
  private readonly revisions = new Map<string, string>();
  private readonly localContext = new Map<string, LocalMutationContext>();

  private snapshot: ConfigurationLayerData = { entries: {} };
  private online = true;
  private loaded = false;
  private syncInFlight: Promise<SyncResult> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private retryAttempt = 0;
  private mutationCounter = 0;

  constructor(options: ConfigSyncOrchestratorOptions) {
    this.tenantId = options.tenantId;
    this.cache = options.cache;
    this.transport = options.transport;
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.retryBaseMs = options.retryPolicy?.baseDelayMs ?? DEFAULT_RETRY_BASE_MS;
    this.retryMaxMs = options.retryPolicy?.maxDelayMs ?? DEFAULT_RETRY_MAX_MS;
    this.conflictResolution = options.conflictResolution ?? "server-authoritative";
    this.now = options.now ?? (() => Date.now());
    this.store = new DiagnosticsStore({
      tenantId: this.tenantId,
      queue: { tenantId: this.tenantId, pendingCount: 0, inFlightCount: 0 },
      retryAttempt: 0,
    });
  }

  async load(): Promise<ConfigurationLayerData> {
    this.snapshot = await this.cache.loadSnapshot(this.tenantId);
    this.loaded = true;
    const queue = await this.cache.getQueueMetadata(this.tenantId);
    this.store.updateDiagnostics({ queue, lastSyncedAt: this.snapshot.lastSyncedAt, retryAttempt: 0, retryScheduledAt: undefined });

    if (!this.online) {
      this.store.setSyncState({
        status: "offline",
        lastSyncedAt: this.snapshot.lastSyncedAt ?? 0,
        pendingWriteCount: queue.pendingCount + queue.inFlightCount,
      });
      return cloneSnapshot(this.snapshot);
    }

    this.store.setSyncState(
      this.snapshot.lastSyncedAt === undefined
        ? { status: "syncing" }
        : { status: "synced", lastSyncedAt: this.snapshot.lastSyncedAt },
    );
    this.triggerSync();
    return cloneSnapshot(this.snapshot);
  }

  async write(key: string, value: unknown): Promise<void> {
    await this.ensureLoaded();
    this.mutationCounter += 1;
    const mutation = createMutation(
      this.tenantId,
      this.now,
      this.mutationCounter,
      "set",
      key,
      value,
      this.revisions.get(key),
    );
    this.snapshot.entries[key] = value;
    this.pendingWrites.set(key, value);
    this.localContext.set(mutation.mutationId, { mutation, localValue: value, localRevision: mutation.baseRevision });
    await this.cache.saveSnapshot(this.tenantId, cloneSnapshot(this.snapshot));
    await this.cache.enqueueMutation(this.tenantId, mutation);
    await this.refreshQueueDiagnostics();
    this.updateOfflineOrSchedule();
  }

  async remove(key: string): Promise<void> {
    await this.ensureLoaded();
    this.mutationCounter += 1;
    const mutation = createMutation(
      this.tenantId,
      this.now,
      this.mutationCounter,
      "remove",
      key,
      undefined,
      this.revisions.get(key),
    );
    delete this.snapshot.entries[key];
    this.pendingWrites.set(key, undefined);
    this.localContext.set(mutation.mutationId, { mutation, localValue: undefined, localRevision: mutation.baseRevision });
    await this.cache.saveSnapshot(this.tenantId, cloneSnapshot(this.snapshot));
    await this.cache.enqueueMutation(this.tenantId, mutation);
    await this.refreshQueueDiagnostics();
    this.updateOfflineOrSchedule();
  }

  sync(): Promise<SyncResult> {
    if (this.syncInFlight !== undefined) {
      return this.syncInFlight;
    }
    const run = this.runSyncCycle().finally(() => {
      this.syncInFlight = undefined;
    });
    this.syncInFlight = run;
    return run;
  }

  triggerSync(): void {
    void this.sync();
  }

  setOnline(isOnline: boolean): void {
    this.online = isOnline;
    if (!isOnline) {
      this.clearRetryTimer();
      const queue = this.store.getDiagnostics().queue;
      this.store.setSyncState({
        status: "offline",
        lastSyncedAt: this.snapshot.lastSyncedAt ?? 0,
        pendingWriteCount: queue.pendingCount + queue.inFlightCount,
      });
      return;
    }
    this.retryAttempt = 0;
    this.triggerSync();
  }

  getSyncState() {
    return this.store.getSyncState();
  }

  onSyncStateChange(listener: (state: ReturnType<DiagnosticsStore["getSyncState"]>) => void): () => void {
    return this.store.onSyncStateChange(listener);
  }

  getDiagnostics(): SyncDiagnostics {
    return this.store.getDiagnostics();
  }

  onDiagnosticsChange(listener: (diagnostics: SyncDiagnostics) => void): () => void {
    return this.store.onDiagnosticsChange(listener);
  }

  getPendingWrites(): ReadonlyMap<string, unknown> {
    return new Map(this.pendingWrites);
  }

  private async runSyncCycle(): Promise<SyncResult> {
    await this.ensureLoaded();
    if (!this.online) {
      const queue = await this.cache.getQueueMetadata(this.tenantId);
      this.store.updateDiagnostics({ queue });
      this.store.setSyncState({
        status: "offline",
        lastSyncedAt: this.snapshot.lastSyncedAt ?? 0,
        pendingWriteCount: queue.pendingCount + queue.inFlightCount,
      });
      return { pulled: 0, pushed: 0, conflicts: [] };
    }

    this.clearRetryTimer();
    this.store.setSyncState({ status: "syncing" });

    const push = await flushQueue({
      tenantId: this.tenantId,
      cache: this.cache,
      transport: this.transport,
      batchSize: this.batchSize,
      now: this.now,
      snapshot: this.snapshot,
      pendingWrites: this.pendingWrites,
      revisions: this.revisions,
      localContext: this.localContext,
      conflictResolution: this.conflictResolution,
      createMutation: (operation, key, value, forcedBaseRevision) => {
        this.mutationCounter += 1;
        return createMutation(
          this.tenantId,
          this.now,
          this.mutationCounter,
          operation,
          key,
          value,
          forcedBaseRevision,
        );
      },
      onError: async (syncError) => {
        const queue = await this.cache.getQueueMetadata(this.tenantId);
        this.store.updateDiagnostics({ queue, lastError: syncError });
        if (syncError.retryable) {
          this.scheduleRetry(syncError);
        } else {
          this.clearRetryTimer();
        }
        this.store.setSyncState({ status: "error", error: syncError.message, lastSyncedAt: this.snapshot.lastSyncedAt });
      },
    });

    if (push.shouldStop) {
      return { pulled: 0, pushed: push.pushed, conflicts: push.conflicts };
    }

    const pulled = await pullChanges({
      tenantId: this.tenantId,
      cache: this.cache,
      transport: this.transport,
      batchSize: this.batchSize,
      now: this.now,
      snapshot: this.snapshot,
      pendingWrites: this.pendingWrites,
      revisions: this.revisions,
      localContext: this.localContext,
      conflictResolution: this.conflictResolution,
      createMutation: () => {
        throw new Error("createMutation is unused in pullChanges");
      },
    });

    const queue = await this.cache.getQueueMetadata(this.tenantId);
    const lastSyncedAt = this.snapshot.lastSyncedAt ?? this.now();
    this.store.updateDiagnostics({ queue, lastSyncedAt, retryAttempt: 0, retryScheduledAt: undefined });
    this.retryAttempt = 0;

    if (push.conflicts.length > 0) {
      this.store.setSyncState({ status: "conflict", conflicts: push.conflicts });
    } else if (queue.pendingCount + queue.inFlightCount > 0) {
      this.store.setSyncState({ status: "syncing" });
    } else {
      this.store.setSyncState({ status: "synced", lastSyncedAt });
    }

    return { pulled, pushed: push.pushed, conflicts: push.conflicts };
  }

  private scheduleRetry(lastError: ReturnType<typeof classifySyncError>): void {
    const next = scheduleRetryState(this.retryAttempt, lastError, {
      retryBaseMs: this.retryBaseMs,
      retryMaxMs: this.retryMaxMs,
      now: this.now,
    });
    this.retryAttempt = next.retryAttempt;
    this.clearRetryTimer();
    this.store.updateDiagnostics(next);

    const delay = calculateRetryDelay({
      retryAttempt: next.retryAttempt,
      retryBaseMs: this.retryBaseMs,
      retryMaxMs: this.retryMaxMs,
      now: this.now,
    });
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      if (this.online) {
        this.triggerSync();
      }
    }, delay);
    (this.retryTimer as { unref?: () => void }).unref?.();
  }

  private updateOfflineOrSchedule(): void {
    if (!this.online) {
      const queue = this.store.getDiagnostics().queue;
      this.store.setSyncState({
        status: "offline",
        lastSyncedAt: this.snapshot.lastSyncedAt ?? 0,
        pendingWriteCount: queue.pendingCount + queue.inFlightCount,
      });
      return;
    }
    this.triggerSync();
  }

  private async refreshQueueDiagnostics(): Promise<void> {
    this.store.updateDiagnostics({ queue: await this.cache.getQueueMetadata(this.tenantId) });
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== undefined) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
  }
}
