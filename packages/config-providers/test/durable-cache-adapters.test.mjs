import test from "node:test";
import assert from "node:assert/strict";

import {
  IndexedDbDurableConfigCacheAdapter,
  MemoryDurableConfigCacheAdapter,
} from "../dist/index.js";

const DEFAULT_ERROR = { code: "network", message: "offline", retryable: true };

class FakeDbRegistry {
  constructor() {
    this.databases = new Map();
  }

  get(name) {
    if (!this.databases.has(name)) {
      this.databases.set(name, new FakeDatabase(name));
    }
    return this.databases.get(name);
  }
}

class FakeIdbFactory {
  constructor(registry = new FakeDbRegistry()) {
    this.registry = registry;
  }

  open(name) {
    const request = new FakeOpenRequest();
    queueMicrotask(() => {
      const db = this.registry.get(name);
      request.result = db;
      request.onupgradeneeded?.({ target: request });
      request.onsuccess?.({ target: request });
    });
    return request;
  }
}

class FakeOpenRequest {
  constructor() {
    this.result = undefined;
    this.error = null;
    this.onupgradeneeded = null;
    this.onsuccess = null;
    this.onerror = null;
  }
}

class FakeDatabase {
  constructor(name) {
    this.name = name;
    this.stores = new Map();
    this.objectStoreNames = {
      contains: (storeName) => this.stores.has(storeName),
    };
  }

  createObjectStore(storeName) {
    if (!this.stores.has(storeName)) {
      this.stores.set(storeName, new Map());
    }
    return { name: storeName };
  }

  transaction(storeName) {
    if (!this.stores.has(storeName)) {
      this.stores.set(storeName, new Map());
    }
    return new FakeTransaction(this.stores.get(storeName));
  }
}

class FakeTransaction {
  constructor(storeMap) {
    this.storeMap = storeMap;
  }

  objectStore() {
    return new FakeObjectStore(this.storeMap);
  }
}

class FakeObjectStore {
  constructor(storeMap) {
    this.storeMap = storeMap;
  }

  get(key) {
    const request = new FakeRequest();
    queueMicrotask(() => {
      request.result = this.storeMap.get(String(key));
      request.onsuccess?.({ target: request });
    });
    return request;
  }

  put(value, key) {
    const request = new FakeRequest();
    queueMicrotask(() => {
      this.storeMap.set(String(key), structuredClone(value));
      request.result = key;
      request.onsuccess?.({ target: request });
    });
    return request;
  }
}

class FakeRequest {
  constructor() {
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }
}

function buildMutation(tenantId, mutationId, operation, value = undefined) {
  return {
    mutationId,
    tenantId,
    key: `ghost.key.${mutationId}`,
    operation,
    value,
    metadata: {
      queuedAt: 1000 + Number(mutationId.replace(/\D/g, "") || 0),
      attemptCount: 0,
      policyAllowed: true,
    },
  };
}

async function verifyDurableContract(cacheFactory) {
  const cache = cacheFactory();

  await cache.saveSnapshot("tenant-a", { entries: { theme: "dark" } });
  await cache.saveSnapshot("tenant-b", { entries: { theme: "light" } });

  const aSnapshot = await cache.loadSnapshot("tenant-a");
  const bSnapshot = await cache.loadSnapshot("tenant-b");
  assert.deepEqual(aSnapshot.entries, { theme: "dark" });
  assert.deepEqual(bSnapshot.entries, { theme: "light" });

  await cache.setCursor("tenant-a", { serverRevision: "rev-a", serverTime: 10 });
  await cache.setCursor("tenant-b", { serverRevision: "rev-b", serverTime: 20, feedToken: "f-b" });
  assert.deepEqual(await cache.getCursor("tenant-a"), { serverRevision: "rev-a", serverTime: 10 });
  assert.deepEqual(await cache.getCursor("tenant-b"), {
    serverRevision: "rev-b",
    serverTime: 20,
    feedToken: "f-b",
  });

  const setMutation = buildMutation("tenant-a", "m1", "set", "value-1");
  const removeMutation = buildMutation("tenant-a", "m2", "remove");
  const tenantBMutation = buildMutation("tenant-b", "m3", "set", "value-3");

  await cache.enqueueMutation("tenant-a", setMutation);
  await cache.enqueueMutation("tenant-a", removeMutation);
  await cache.enqueueMutation("tenant-b", tenantBMutation);

  const beforeFlight = await cache.peekQueuedMutations("tenant-a", 10);
  assert.deepEqual(beforeFlight.map((m) => m.mutationId), ["m1", "m2"]);
  assert.equal(beforeFlight[1].operation, "remove");
  assert.equal("value" in beforeFlight[1], true);
  assert.equal(beforeFlight[1].value, undefined);

  await cache.markRequestInFlight("tenant-a", "req-1", ["m1", "m2"]);
  const afterMark = await cache.peekQueuedMutations("tenant-a", 10);
  assert.deepEqual(afterMark, []);

  const markedMeta = await cache.getQueueMetadata("tenant-a");
  assert.equal(markedMeta.pendingCount, 0);
  assert.equal(markedMeta.inFlightCount, 2);
  assert.equal(markedMeta.oldestQueuedAt, 1001);
  assert.equal(markedMeta.newestQueuedAt, 1002);

  await cache.releaseRequest("tenant-a", "req-1", DEFAULT_ERROR);
  const afterRelease = await cache.peekQueuedMutations("tenant-a", 10);
  assert.deepEqual(afterRelease.map((m) => m.mutationId), ["m1", "m2"]);
  assert.equal(afterRelease[1].operation, "remove");

  await cache.markRequestInFlight("tenant-a", "req-2", ["m1", "m2"]);
  await cache.acknowledgeRequest("tenant-a", "req-2");
  const afterAck = await cache.getQueueMetadata("tenant-a");
  assert.equal(afterAck.pendingCount, 0);
  assert.equal(afterAck.inFlightCount, 0);

  const tenantBQueue = await cache.peekQueuedMutations("tenant-b", 10);
  assert.deepEqual(tenantBQueue.map((m) => m.mutationId), ["m3"]);
}

test("MemoryDurableConfigCacheAdapter satisfies durable cache contract", async () => {
  await verifyDurableContract(() => new MemoryDurableConfigCacheAdapter());
});

test("IndexedDbDurableConfigCacheAdapter satisfies durable cache contract", async () => {
  const factory = new FakeIdbFactory();
  await verifyDurableContract(
    () => new IndexedDbDurableConfigCacheAdapter({ dbName: "test-db-1", indexedDB: factory }),
  );
});

test("IndexedDbDurableConfigCacheAdapter persists state across instances", async () => {
  const factory = new FakeIdbFactory();
  const first = new IndexedDbDurableConfigCacheAdapter({ dbName: "test-db-2", indexedDB: factory });

  await first.saveSnapshot("tenant-a", { entries: { locale: "en-US" } });
  await first.setCursor("tenant-a", { serverRevision: "rev-22", serverTime: 2000 });
  await first.enqueueMutation("tenant-a", buildMutation("tenant-a", "m4", "set", "v4"));

  const second = new IndexedDbDurableConfigCacheAdapter({ dbName: "test-db-2", indexedDB: factory });
  const snapshot = await second.loadSnapshot("tenant-a");
  const cursor = await second.getCursor("tenant-a");
  const queue = await second.peekQueuedMutations("tenant-a", 10);

  assert.deepEqual(snapshot.entries, { locale: "en-US" });
  assert.deepEqual(cursor, { serverRevision: "rev-22", serverTime: 2000 });
  assert.deepEqual(queue.map((entry) => entry.mutationId), ["m4"]);
});
