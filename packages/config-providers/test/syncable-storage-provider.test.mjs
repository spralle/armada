import assert from "node:assert/strict";
import test from "node:test";

import {
  ConfigSyncRpcTransportError,
  MemoryDurableConfigCacheAdapter,
  createSyncableStorageProvider,
} from "../dist/index.js";

function createFakeTransport(overrides = {}) {
  return {
    pull: overrides.pull ?? (async (request) => ({
      tenantId: request.tenantId,
      cursor: { serverRevision: "rev-0", serverTime: 0 },
      serverTime: 0,
      changes: [],
    })),
    push: overrides.push ?? (async (request) => ({
      tenantId: request.tenantId,
      requestId: request.requestId,
      serverRevision: "rev-1",
      serverTime: 100,
      results: request.mutations.map((mutation, idx) => ({
        mutationId: mutation.mutationId,
        accepted: true,
        revision: `rev-${idx + 1}`,
      })),
    })),
    ack: overrides.ack ?? (async (request) => ({
      tenantId: request.tenantId,
      requestId: request.requestId,
      acked: true,
      serverRevision: "rev-1",
      serverTime: 100,
    })),
  };
}

test("syncable provider loads cached snapshot and writes queue", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  await cache.saveSnapshot("tenant-a", { entries: { "ghost.theme": "dark" }, lastSyncedAt: 10, revision: "rev-a" });

  const provider = createSyncableStorageProvider({
    id: "sync-user",
    layer: "user",
    tenantId: "tenant-a",
    cache,
    transport: createFakeTransport(),
  });

  const loaded = await provider.load();
  assert.equal(loaded.entries["ghost.theme"], "dark");
  await provider.write("ghost.mode", "compact");
  const queue = await cache.peekQueuedMutations("tenant-a", 10);
  assert.equal(queue.length > 0, true);
});

test("sync diagnostics surface retry metadata", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const provider = createSyncableStorageProvider({
    id: "sync-user",
    layer: "user",
    tenantId: "tenant-a",
    cache,
    transport: createFakeTransport({
      push: async () => {
        throw new ConfigSyncRpcTransportError({ code: "network", message: "offline", retryable: true });
      },
    }),
  });

  provider.setOnline(false);
  await provider.load();
  await provider.write("ghost.retry", true);
  provider.setOnline(true);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const diagnostics = provider.getSyncDiagnostics();
  assert.equal(diagnostics.retryAttempt > 0, true);
  assert.equal(typeof diagnostics.retryScheduledAt, "number");
});

test("tenant isolation via separate providers and shared cache", async () => {
  const cache = new MemoryDurableConfigCacheAdapter();
  const a = createSyncableStorageProvider({
    id: "sync-a",
    layer: "user",
    tenantId: "tenant-a",
    cache,
    transport: createFakeTransport(),
  });
  const b = createSyncableStorageProvider({
    id: "sync-b",
    layer: "user",
    tenantId: "tenant-b",
    cache,
    transport: createFakeTransport(),
  });

  a.setOnline(false);
  b.setOnline(false);
  await a.load();
  await b.load();
  await a.write("ghost.theme", "dark");
  await b.write("ghost.theme", "light");

  const queuedA = await cache.peekQueuedMutations("tenant-a", 10);
  const queuedB = await cache.peekQueuedMutations("tenant-b", 10);
  assert.equal(queuedA.length, 1);
  assert.equal(queuedB.length, 1);
});
