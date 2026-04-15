import { z } from "zod";

export const syncCursorSchema = z.object({
  serverRevision: z.string(),
  serverTime: z.number(),
  feedToken: z.string().optional(),
}).strict();

export const syncMutationOperationSchema = z.enum(["set", "remove"]);

export const syncMutationMetadataSchema = z.object({
  queuedAt: z.number(),
  attemptCount: z.number(),
  lastAttemptAt: z.number().optional(),
  policyAllowed: z.boolean(),
}).strict();

export const syncQueuedMutationSchema = z.object({
  mutationId: z.string(),
  tenantId: z.string(),
  key: z.string(),
  operation: syncMutationOperationSchema,
  value: z.unknown().optional(),
  baseRevision: z.string().optional(),
  metadata: syncMutationMetadataSchema,
}).strict();

export const syncRemoteChangeSchema = z.object({
  key: z.string(),
  value: z.unknown().optional(),
  operation: syncMutationOperationSchema,
  revision: z.string(),
  serverTime: z.number(),
}).strict();

export const syncErrorCodeSchema = z.enum([
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

export const syncErrorMetadataSchema = z.object({
  code: syncErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean(),
  status: z.number().optional(),
  key: z.string().optional(),
  mutationId: z.string().optional(),
  serverTime: z.number().optional(),
  details: z.record(z.string(), z.unknown()).readonly().optional(),
}).strict();

export const syncConflictMetadataSchema = z.object({
  key: z.string(),
  mutationId: z.string().optional(),
  localRevision: z.string().optional(),
  serverRevision: z.string(),
  localValue: z.unknown().optional(),
  serverValue: z.unknown().optional(),
  serverTime: z.number(),
}).strict();

export const configSyncPullRequestSchema = z.object({
  tenantId: z.string(),
  cursor: syncCursorSchema.optional(),
  limit: z.number().int().positive().optional(),
}).strict();

export const configSyncPullResponseSchema = z.object({
  tenantId: z.string(),
  cursor: syncCursorSchema,
  serverTime: z.number(),
  changes: z.array(syncRemoteChangeSchema).readonly(),
}).strict();

export const configSyncPushRequestSchema = z.object({
  tenantId: z.string(),
  requestId: z.string(),
  mutations: z.array(syncQueuedMutationSchema).readonly(),
}).strict();

export const configSyncPushResultSchema = z.object({
  mutationId: z.string(),
  accepted: z.boolean(),
  revision: z.string().optional(),
  conflict: syncConflictMetadataSchema.optional(),
  error: syncErrorMetadataSchema.optional(),
}).strict();

export const configSyncPushResponseSchema = z.object({
  tenantId: z.string(),
  requestId: z.string(),
  serverRevision: z.string(),
  serverTime: z.number(),
  results: z.array(configSyncPushResultSchema).readonly(),
}).strict();

export const configSyncAckRequestSchema = z.object({
  tenantId: z.string(),
  requestId: z.string(),
}).strict();

export const configSyncAckResponseSchema = z.object({
  tenantId: z.string(),
  requestId: z.string(),
  acked: z.boolean(),
  serverRevision: z.string(),
  serverTime: z.number(),
}).strict();
