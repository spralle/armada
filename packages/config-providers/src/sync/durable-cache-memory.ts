import type {
  ConfigurationLayerData,
  DurableConfigCache,
  SyncCursor,
  SyncErrorMetadata,
  SyncQueueMetadata,
  SyncQueuedMutation,
} from "@ghost/config-types";

interface InFlightRequest {
  requestId: string;
  mutations: SyncQueuedMutation[];
}

interface TenantQueueState {
  pending: SyncQueuedMutation[];
  inFlight: InFlightRequest[];
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptySnapshot(): ConfigurationLayerData {
  return { entries: {} };
}

export class MemoryDurableConfigCacheAdapter implements DurableConfigCache {
  private readonly snapshots = new Map<string, ConfigurationLayerData>();
  private readonly cursors = new Map<string, SyncCursor>();
  private readonly queues = new Map<string, TenantQueueState>();

  async loadSnapshot(tenantId: string): Promise<ConfigurationLayerData> {
    const snapshot = this.snapshots.get(tenantId);
    return snapshot === undefined ? emptySnapshot() : cloneValue(snapshot);
  }

  async saveSnapshot(tenantId: string, data: ConfigurationLayerData): Promise<void> {
    this.snapshots.set(tenantId, cloneValue(data));
  }

  async getCursor(tenantId: string): Promise<SyncCursor | undefined> {
    const cursor = this.cursors.get(tenantId);
    return cursor === undefined ? undefined : cloneValue(cursor);
  }

  async setCursor(tenantId: string, cursor: SyncCursor): Promise<void> {
    this.cursors.set(tenantId, cloneValue(cursor));
  }

  async enqueueMutation(tenantId: string, mutation: SyncQueuedMutation): Promise<void> {
    const queue = this.getOrCreateQueue(tenantId);
    queue.pending.push(cloneValue(mutation));
  }

  async peekQueuedMutations(tenantId: string, limit: number): Promise<ReadonlyArray<SyncQueuedMutation>> {
    const queue = this.getOrCreateQueue(tenantId);
    return queue.pending.slice(0, limit).map((mutation) => cloneValue(mutation));
  }

  async markRequestInFlight(tenantId: string, requestId: string, mutationIds: ReadonlyArray<string>): Promise<void> {
    const queue = this.getOrCreateQueue(tenantId);
    const picked: SyncQueuedMutation[] = [];
    const pickedIdSet = new Set(mutationIds);

    queue.pending = queue.pending.filter((mutation) => {
      if (!pickedIdSet.has(mutation.mutationId)) {
        return true;
      }
      picked.push({
        ...mutation,
        metadata: {
          ...mutation.metadata,
          attemptCount: mutation.metadata.attemptCount + 1,
          lastAttemptAt: Date.now(),
        },
      });
      return false;
    });

    if (picked.length === 0) {
      return;
    }

    queue.inFlight = queue.inFlight.filter((entry) => entry.requestId !== requestId);
    queue.inFlight.push({ requestId, mutations: picked });
  }

  async acknowledgeRequest(tenantId: string, requestId: string): Promise<void> {
    const queue = this.getOrCreateQueue(tenantId);
    queue.inFlight = queue.inFlight.filter((entry) => entry.requestId !== requestId);
  }

  async releaseRequest(tenantId: string, requestId: string, _error: SyncErrorMetadata): Promise<void> {
    const queue = this.getOrCreateQueue(tenantId);
    const remainingInFlight: InFlightRequest[] = [];
    let released: SyncQueuedMutation[] = [];

    for (const entry of queue.inFlight) {
      if (entry.requestId === requestId) {
        released = entry.mutations;
      } else {
        remainingInFlight.push(entry);
      }
    }

    queue.inFlight = remainingInFlight;
    if (released.length > 0) {
      queue.pending = [...released, ...queue.pending];
    }
  }

  async getQueueMetadata(tenantId: string): Promise<SyncQueueMetadata> {
    const queue = this.getOrCreateQueue(tenantId);
    const allQueued = [...queue.pending, ...queue.inFlight.flatMap((entry) => entry.mutations)];
    const queuedAtValues = allQueued.map((mutation) => mutation.metadata.queuedAt);

    return {
      tenantId,
      pendingCount: queue.pending.length,
      inFlightCount: queue.inFlight.reduce((count, entry) => count + entry.mutations.length, 0),
      oldestQueuedAt: queuedAtValues.length > 0 ? Math.min(...queuedAtValues) : undefined,
      newestQueuedAt: queuedAtValues.length > 0 ? Math.max(...queuedAtValues) : undefined,
    };
  }

  private getOrCreateQueue(tenantId: string): TenantQueueState {
    const existing = this.queues.get(tenantId);
    if (existing !== undefined) {
      return existing;
    }

    const created: TenantQueueState = { pending: [], inFlight: [] };
    this.queues.set(tenantId, created);
    return created;
  }
}
