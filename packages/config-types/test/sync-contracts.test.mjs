import test from "node:test";
import assert from "node:assert/strict";

import {
  syncCursorSchema,
  syncQueueMetadataSchema,
  syncQueuedMutationSchema,
  syncErrorMetadataSchema,
  syncConflictMetadataSchema,
  configSyncPullRequestSchema,
  configSyncPullResponseSchema,
  configSyncPushRequestSchema,
  configSyncPushResponseSchema,
  configSyncAckRequestSchema,
  configSyncAckResponseSchema,
  configSyncFeedSubscriptionRequestSchema,
  configSyncFeedEventSchema,
} from "../dist/index.js";

test("syncCursorSchema accepts authoritative server cursor", () => {
  const result = syncCursorSchema.safeParse({
    serverRevision: "rev-42",
    serverTime: 1713123456789,
    feedToken: "feed-1",
  });

  assert.equal(result.success, true);
});

test("syncQueueMetadataSchema accepts queue counters", () => {
  const result = syncQueueMetadataSchema.safeParse({
    tenantId: "tenant-a",
    pendingCount: 3,
    inFlightCount: 1,
    oldestQueuedAt: 1713123400000,
    newestQueuedAt: 1713123450000,
  });

  assert.equal(result.success, true);
});

test("syncQueuedMutationSchema accepts policy-allowed queued write", () => {
  const result = syncQueuedMutationSchema.safeParse({
    mutationId: "mut-1",
    tenantId: "tenant-a",
    key: "ghost.theme",
    operation: "set",
    value: "dark",
    baseRevision: "rev-41",
    metadata: {
      queuedAt: 1713123400000,
      attemptCount: 0,
      policyAllowed: true,
    },
  });

  assert.equal(result.success, true);
});

test("syncErrorMetadataSchema accepts retryable transport error", () => {
  const result = syncErrorMetadataSchema.safeParse({
    code: "network",
    message: "Temporary disconnect",
    retryable: true,
    details: { phase: "push" },
  });

  assert.equal(result.success, true);
});

test("syncConflictMetadataSchema enforces server-time conflict metadata", () => {
  const result = syncConflictMetadataSchema.safeParse({
    key: "ghost.theme",
    mutationId: "mut-1",
    localRevision: "rev-41",
    serverRevision: "rev-42",
    localValue: "dark",
    serverValue: "light",
    serverTime: 1713123500000,
  });

  assert.equal(result.success, true);
});

test("configSyncPullRequestSchema validates optional cursor and positive limit", () => {
  const ok = configSyncPullRequestSchema.safeParse({
    tenantId: "tenant-a",
    cursor: { serverRevision: "rev-42", serverTime: 1713123456789 },
    limit: 100,
  });
  assert.equal(ok.success, true);

  const badLimit = configSyncPullRequestSchema.safeParse({
    tenantId: "tenant-a",
    limit: 0,
  });
  assert.equal(badLimit.success, false);
});

test("configSyncPullResponseSchema validates remote change payload", () => {
  const result = configSyncPullResponseSchema.safeParse({
    tenantId: "tenant-a",
    cursor: { serverRevision: "rev-43", serverTime: 1713123550000 },
    serverTime: 1713123550000,
    changes: [
      {
        key: "ghost.theme",
        operation: "set",
        value: "light",
        revision: "rev-43",
        serverTime: 1713123550000,
      },
    ],
  });

  assert.equal(result.success, true);
});

test("configSyncPushRequestSchema validates batched queued mutations", () => {
  const result = configSyncPushRequestSchema.safeParse({
    tenantId: "tenant-a",
    requestId: "req-1",
    mutations: [
      {
        mutationId: "mut-1",
        tenantId: "tenant-a",
        key: "ghost.theme",
        operation: "set",
        value: "dark",
        metadata: {
          queuedAt: 1713123400000,
          attemptCount: 0,
          policyAllowed: true,
        },
      },
    ],
  });

  assert.equal(result.success, true);
});

test("configSyncPushResponseSchema supports accepted and conflicted results", () => {
  const result = configSyncPushResponseSchema.safeParse({
    tenantId: "tenant-a",
    requestId: "req-1",
    serverRevision: "rev-43",
    serverTime: 1713123550000,
    results: [
      {
        mutationId: "mut-1",
        accepted: true,
        revision: "rev-43",
      },
      {
        mutationId: "mut-2",
        accepted: false,
        conflict: {
          key: "ghost.locale",
          serverRevision: "rev-43",
          serverTime: 1713123550000,
        },
      },
    ],
  });

  assert.equal(result.success, true);
});

test("configSyncAck request/response use request semantics", () => {
  const ackReq = configSyncAckRequestSchema.safeParse({ tenantId: "tenant-a", requestId: "req-1" });
  assert.equal(ackReq.success, true);

  const ackRes = configSyncAckResponseSchema.safeParse({
    tenantId: "tenant-a",
    requestId: "req-1",
    acked: true,
    serverRevision: "rev-43",
    serverTime: 1713123550000,
  });
  assert.equal(ackRes.success, true);
});

test("configSyncFeed schemas reserve feed-ready contract surface", () => {
  const subReq = configSyncFeedSubscriptionRequestSchema.safeParse({
    tenantId: "tenant-a",
    cursor: { serverRevision: "rev-42", serverTime: 1713123456789 },
  });
  assert.equal(subReq.success, true);

  const readyEvent = configSyncFeedEventSchema.safeParse({
    type: "ready",
    cursor: { serverRevision: "rev-42", serverTime: 1713123456789 },
    serverTime: 1713123456789,
  });
  assert.equal(readyEvent.success, true);
});
