import assert from "node:assert/strict";
import test from "node:test";

import {
  ConfigSyncRpcTransportAdapter,
  ConfigSyncRpcTransportError,
} from "../dist/index.js";

function createFakeClient(overrides = {}) {
  const calls = [];
  const subscriptions = [];

  return {
    calls,
    subscriptions,
    request: async (route, payload) => {
      calls.push({ route, payload });
      if (overrides.request) {
        return overrides.request(route, payload);
      }
      throw new Error("request override missing");
    },
    subscribe: overrides.subscribe
      ? (route, payload, onEvent) => {
          subscriptions.push({ route, payload });
          return overrides.subscribe(route, payload, onEvent);
        }
      : undefined,
  };
}

test("ConfigSyncRpcTransportAdapter maps pull request/response payloads", async () => {
  const fakeClient = createFakeClient({
    request: async () => ({
      tenantId: "tenant-a",
      cursor: { serverRevision: "rev-12", serverTime: 2000, feedToken: "feed-1" },
      serverTime: 2000,
      changes: [
        {
          key: "ghost.feature.enabled",
          operation: "set",
          value: true,
          revision: "rev-12",
          serverTime: 1999,
        },
      ],
    }),
  });

  const transport = new ConfigSyncRpcTransportAdapter({
    client: fakeClient,
    routes: { pull: "rpc.config.pull" },
  });

  const response = await transport.pull({
    tenantId: "tenant-a",
    cursor: { serverRevision: "rev-11", serverTime: 1900 },
    limit: 100,
  });

  assert.equal(fakeClient.calls.length, 1);
  assert.deepEqual(fakeClient.calls[0], {
    route: "rpc.config.pull",
    payload: {
      tenantId: "tenant-a",
      cursor: { serverRevision: "rev-11", serverTime: 1900 },
      limit: 100,
    },
  });

  assert.deepEqual(response, {
    tenantId: "tenant-a",
    cursor: { serverRevision: "rev-12", serverTime: 2000, feedToken: "feed-1" },
    serverTime: 2000,
    changes: [
      {
        key: "ghost.feature.enabled",
        operation: "set",
        value: true,
        revision: "rev-12",
        serverTime: 1999,
      },
    ],
  });
});

test("ConfigSyncRpcTransportAdapter maps push batch including rejected conflicts", async () => {
  const fakeClient = createFakeClient({
    request: async () => ({
      tenantId: "tenant-a",
      requestId: "req-1",
      serverRevision: "rev-20",
      serverTime: 3000,
      results: [
        {
          mutationId: "m-1",
          accepted: true,
          revision: "rev-19",
        },
        {
          mutationId: "m-2",
          accepted: false,
          conflict: {
            key: "ghost.setting.mode",
            mutationId: "m-2",
            localRevision: "rev-18",
            serverRevision: "rev-20",
            localValue: "compact",
            serverValue: "expanded",
            serverTime: 3000,
          },
          error: {
            code: "conflict",
            message: "revision conflict",
            retryable: false,
            mutationId: "m-2",
          },
        },
      ],
    }),
  });

  const transport = new ConfigSyncRpcTransportAdapter({
    client: fakeClient,
    routes: { push: "rpc.config.push" },
  });

  const response = await transport.push({
    tenantId: "tenant-a",
    requestId: "req-1",
    mutations: [
      {
        mutationId: "m-1",
        tenantId: "tenant-a",
        key: "ghost.setting.enabled",
        operation: "set",
        value: true,
        metadata: { queuedAt: 1000, attemptCount: 0, policyAllowed: true },
      },
      {
        mutationId: "m-2",
        tenantId: "tenant-a",
        key: "ghost.setting.mode",
        operation: "set",
        value: "compact",
        baseRevision: "rev-18",
        metadata: { queuedAt: 1001, attemptCount: 0, policyAllowed: true },
      },
    ],
  });

  assert.equal(fakeClient.calls.length, 1);
  assert.equal(fakeClient.calls[0].route, "rpc.config.push");
  assert.deepEqual(response.results.map((entry) => ({ mutationId: entry.mutationId, accepted: entry.accepted })), [
    { mutationId: "m-1", accepted: true },
    { mutationId: "m-2", accepted: false },
  ]);
  assert.equal(response.results[1].conflict?.key, "ghost.setting.mode");
  assert.equal(response.results[1].error?.code, "conflict");
});

test("ConfigSyncRpcTransportAdapter maps ack request/response payloads", async () => {
  const fakeClient = createFakeClient({
    request: async () => ({
      tenantId: "tenant-b",
      requestId: "req-2",
      acked: true,
      serverRevision: "rev-21",
      serverTime: 4000,
    }),
  });
  const transport = new ConfigSyncRpcTransportAdapter({
    client: fakeClient,
    routes: { ack: "rpc.config.ack" },
  });

  const response = await transport.ack({ tenantId: "tenant-b", requestId: "req-2" });

  assert.deepEqual(fakeClient.calls[0], {
    route: "rpc.config.ack",
    payload: { tenantId: "tenant-b", requestId: "req-2" },
  });
  assert.deepEqual(response, {
    tenantId: "tenant-b",
    requestId: "req-2",
    acked: true,
    serverRevision: "rev-21",
    serverTime: 4000,
  });
});

test("ConfigSyncRpcTransportAdapter classifies retryable vs non-retryable errors", async () => {
  const retryableClient = createFakeClient({
    request: async () => {
      const error = new Error("offline");
      error.code = "ECONNRESET";
      throw error;
    },
  });
  const retryableTransport = new ConfigSyncRpcTransportAdapter({ client: retryableClient });

  await assert.rejects(
    () => retryableTransport.pull({ tenantId: "tenant-a" }),
    (error) => {
      assert.equal(error instanceof ConfigSyncRpcTransportError, true);
      assert.equal(error.syncError.code, "network");
      assert.equal(error.syncError.retryable, true);
      return true;
    },
  );

  const nonRetryableClient = createFakeClient({
    request: async () => {
      const error = new Error("unauthorized");
      error.status = 401;
      throw error;
    },
  });
  const nonRetryableTransport = new ConfigSyncRpcTransportAdapter({ client: nonRetryableClient });

  await assert.rejects(
    () => nonRetryableTransport.ack({ tenantId: "tenant-a", requestId: "req-x" }),
    (error) => {
      assert.equal(error instanceof ConfigSyncRpcTransportError, true);
      assert.equal(error.syncError.code, "unauthorized");
      assert.equal(error.syncError.retryable, false);
      return true;
    },
  );
});

test("ConfigSyncRpcTransportAdapter exposes optional feed subscription hook", async () => {
  const fakeClient = createFakeClient({
    subscribe: (route, payload, onEvent) => {
      onEvent({
        type: "ready",
        cursor: { serverRevision: "rev-feed", serverTime: 5000 },
        serverTime: 5000,
      });
      return () => {
        void route;
        void payload;
      };
    },
  });

  const events = [];
  const transport = new ConfigSyncRpcTransportAdapter({
    client: fakeClient,
    routes: { feed: "rpc.config.feed" },
  });

  const unsubscribe = await transport.subscribeToFeed(
    { tenantId: "tenant-feed", cursor: { serverRevision: "rev-old", serverTime: 4900 } },
    (event) => events.push(event),
  );

  assert.equal(typeof unsubscribe, "function");
  assert.deepEqual(fakeClient.subscriptions[0], {
    route: "rpc.config.feed",
    payload: {
      tenantId: "tenant-feed",
      cursor: { serverRevision: "rev-old", serverTime: 4900 },
    },
  });
  assert.equal(events[0].type, "ready");

  const noFeedTransport = new ConfigSyncRpcTransportAdapter({
    client: createFakeClient(),
    routes: { feed: undefined },
  });
  const noopUnsubscribe = await noFeedTransport.subscribeToFeed({ tenantId: "tenant-feed" }, () => {});
  assert.equal(typeof noopUnsubscribe, "function");
});
