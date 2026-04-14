import type {
  ConfigurationLayerData,
  DurableConfigCache,
  SyncCursor,
  SyncErrorMetadata,
  SyncQueueMetadata,
  SyncQueuedMutation,
} from "@ghost/config-types";

const SCHEMA_VERSION = 1;
const SNAPSHOTS_STORE = "snapshots";
const CURSORS_STORE = "cursors";
const QUEUES_STORE = "queues";

interface QueueInFlightRequest {
  requestId: string;
  mutations: SyncQueuedMutation[];
}

interface QueueTenantState {
  pending: SyncQueuedMutation[];
  inFlight: QueueInFlightRequest[];
}

interface SnapshotRecord {
  schemaVersion: number;
  data: ConfigurationLayerData;
}

interface CursorRecord {
  schemaVersion: number;
  cursor: SyncCursor;
}

interface QueueRecord {
  schemaVersion: number;
  queue: QueueTenantState;
}

export interface IndexedDbDurableConfigCacheOptions {
  dbName?: string | undefined;
  indexedDB?: IDBFactory | undefined;
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

function emptyQueue(): QueueTenantState {
  return { pending: [], inFlight: [] };
}

function requestToPromise<TResult>(request: IDBRequest<TResult>): Promise<TResult> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });
}

export class IndexedDbDurableConfigCacheAdapter implements DurableConfigCache {
  private readonly dbName: string;
  private readonly indexedDbFactory: IDBFactory;
  private dbPromise: Promise<IDBDatabase> | undefined;

  constructor(options: IndexedDbDurableConfigCacheOptions = {}) {
    this.dbName = options.dbName ?? "ghost-config-sync-cache";
    const indexedDbFactory = options.indexedDB ?? globalThis.indexedDB;
    if (indexedDbFactory === undefined) {
      throw new Error("IndexedDB is not available in this runtime");
    }
    this.indexedDbFactory = indexedDbFactory;
  }

  async loadSnapshot(tenantId: string): Promise<ConfigurationLayerData> {
    const record = await this.getRecord<SnapshotRecord>(SNAPSHOTS_STORE, tenantId);
    return record === undefined ? emptySnapshot() : cloneValue(record.data);
  }

  async saveSnapshot(tenantId: string, data: ConfigurationLayerData): Promise<void> {
    await this.putRecord<SnapshotRecord>(SNAPSHOTS_STORE, tenantId, {
      schemaVersion: SCHEMA_VERSION,
      data: cloneValue(data),
    });
  }

  async getCursor(tenantId: string): Promise<SyncCursor | undefined> {
    const record = await this.getRecord<CursorRecord>(CURSORS_STORE, tenantId);
    return record === undefined ? undefined : cloneValue(record.cursor);
  }

  async setCursor(tenantId: string, cursor: SyncCursor): Promise<void> {
    await this.putRecord<CursorRecord>(CURSORS_STORE, tenantId, {
      schemaVersion: SCHEMA_VERSION,
      cursor: cloneValue(cursor),
    });
  }

  async enqueueMutation(tenantId: string, mutation: SyncQueuedMutation): Promise<void> {
    const queue = await this.getQueue(tenantId);
    queue.pending.push(cloneValue(mutation));
    await this.putQueue(tenantId, queue);
  }

  async peekQueuedMutations(tenantId: string, limit: number): Promise<ReadonlyArray<SyncQueuedMutation>> {
    const queue = await this.getQueue(tenantId);
    return queue.pending.slice(0, limit).map((mutation) => cloneValue(mutation));
  }

  async markRequestInFlight(tenantId: string, requestId: string, mutationIds: ReadonlyArray<string>): Promise<void> {
    const queue = await this.getQueue(tenantId);
    const requestedIds = new Set(mutationIds);
    const selected: SyncQueuedMutation[] = [];

    queue.pending = queue.pending.filter((mutation) => {
      if (!requestedIds.has(mutation.mutationId)) {
        return true;
      }
      selected.push({
        ...mutation,
        metadata: {
          ...mutation.metadata,
          attemptCount: mutation.metadata.attemptCount + 1,
          lastAttemptAt: Date.now(),
        },
      });
      return false;
    });

    if (selected.length === 0) {
      return;
    }

    queue.inFlight = queue.inFlight.filter((entry) => entry.requestId !== requestId);
    queue.inFlight.push({ requestId, mutations: selected });
    await this.putQueue(tenantId, queue);
  }

  async acknowledgeRequest(tenantId: string, requestId: string): Promise<void> {
    const queue = await this.getQueue(tenantId);
    queue.inFlight = queue.inFlight.filter((entry) => entry.requestId !== requestId);
    await this.putQueue(tenantId, queue);
  }

  async releaseRequest(tenantId: string, requestId: string, _error: SyncErrorMetadata): Promise<void> {
    const queue = await this.getQueue(tenantId);
    const remaining: QueueInFlightRequest[] = [];
    let released: SyncQueuedMutation[] = [];

    for (const request of queue.inFlight) {
      if (request.requestId === requestId) {
        released = request.mutations;
      } else {
        remaining.push(request);
      }
    }

    queue.inFlight = remaining;
    if (released.length > 0) {
      queue.pending = [...released, ...queue.pending];
    }

    await this.putQueue(tenantId, queue);
  }

  async getQueueMetadata(tenantId: string): Promise<SyncQueueMetadata> {
    const queue = await this.getQueue(tenantId);
    const all = [...queue.pending, ...queue.inFlight.flatMap((entry) => entry.mutations)];
    const queuedAtValues = all.map((mutation) => mutation.metadata.queuedAt);

    return {
      tenantId,
      pendingCount: queue.pending.length,
      inFlightCount: queue.inFlight.reduce((count, entry) => count + entry.mutations.length, 0),
      oldestQueuedAt: queuedAtValues.length > 0 ? Math.min(...queuedAtValues) : undefined,
      newestQueuedAt: queuedAtValues.length > 0 ? Math.max(...queuedAtValues) : undefined,
    };
  }

  private async getQueue(tenantId: string): Promise<QueueTenantState> {
    const record = await this.getRecord<QueueRecord>(QUEUES_STORE, tenantId);
    if (record === undefined) {
      return emptyQueue();
    }
    return cloneValue(record.queue);
  }

  private async putQueue(tenantId: string, queue: QueueTenantState): Promise<void> {
    await this.putRecord<QueueRecord>(QUEUES_STORE, tenantId, {
      schemaVersion: SCHEMA_VERSION,
      queue: cloneValue(queue),
    });
  }

  private async getRecord<TRecord>(storeName: string, key: string): Promise<TRecord | undefined> {
    const db = await this.getDatabase();
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const result = await requestToPromise(store.get(key));
    return result as TRecord | undefined;
  }

  private async putRecord<TRecord>(storeName: string, key: string, record: TRecord): Promise<void> {
    const db = await this.getDatabase();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    await requestToPromise(store.put(record, key));
  }

  private async getDatabase(): Promise<IDBDatabase> {
    if (this.dbPromise !== undefined) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = this.indexedDbFactory.open(this.dbName, SCHEMA_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(SNAPSHOTS_STORE)) {
          database.createObjectStore(SNAPSHOTS_STORE);
        }
        if (!database.objectStoreNames.contains(CURSORS_STORE)) {
          database.createObjectStore(CURSORS_STORE);
        }
        if (!database.objectStoreNames.contains(QUEUES_STORE)) {
          database.createObjectStore(QUEUES_STORE);
        }
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("Unable to open IndexedDB durable cache"));
      };
    });

    return this.dbPromise;
  }
}
