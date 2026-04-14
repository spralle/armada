import { z } from "zod";
import { configurationLayerSchema } from "./schemas-core.js";

// --- Write result and change schemas ---

export const writeResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  revision: z.string().optional(),
}).strict();

export const configurationChangeSchema = z.object({
  key: z.string(),
  oldValue: z.unknown(),
  newValue: z.unknown(),
}).strict();

// --- Conflict and sync schemas ---

export const configurationConflictSchema = z.object({
  key: z.string(),
  localValue: z.unknown(),
  remoteValue: z.unknown(),
  localRevision: z.string(),
  remoteRevision: z.string(),
}).strict();

export const syncResultSchema = z.object({
  pulled: z.number(),
  pushed: z.number(),
  conflicts: z.array(configurationConflictSchema),
}).strict();

export const syncCursorSchema = z.object({
  serverRevision: z.string(),
  serverTime: z.number(),
  feedToken: z.string().optional(),
}).strict();

export const syncQueueMetadataSchema = z.object({
  tenantId: z.string(),
  pendingCount: z.number(),
  inFlightCount: z.number(),
  oldestQueuedAt: z.number().optional(),
  newestQueuedAt: z.number().optional(),
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

export const configSyncFeedSubscriptionRequestSchema = z.object({
  tenantId: z.string(),
  cursor: syncCursorSchema.optional(),
}).strict();

export const configSyncFeedReadyEventSchema = z.object({
  type: z.literal("ready"),
  cursor: syncCursorSchema,
  serverTime: z.number(),
}).strict();

export const configSyncFeedChangeEventSchema = z.object({
  type: z.literal("change"),
  change: syncRemoteChangeSchema,
}).strict();

export const configSyncFeedErrorEventSchema = z.object({
  type: z.literal("error"),
  error: syncErrorMetadataSchema,
}).strict();

export const configSyncFeedClosedEventSchema = z.object({
  type: z.literal("closed"),
  reason: z.string().optional(),
}).strict();

export const configSyncFeedEventSchema = z.discriminatedUnion("type", [
  configSyncFeedReadyEventSchema,
  configSyncFeedChangeEventSchema,
  configSyncFeedErrorEventSchema,
  configSyncFeedClosedEventSchema,
]);

export const syncStatusSyncedSchema = z.object({
  status: z.literal("synced"),
  lastSyncedAt: z.number(),
}).strict();

export const syncStatusSyncingSchema = z.object({
  status: z.literal("syncing"),
}).strict();

export const syncStatusOfflineSchema = z.object({
  status: z.literal("offline"),
  lastSyncedAt: z.number(),
  pendingWriteCount: z.number(),
}).strict();

export const syncStatusConflictSchema = z.object({
  status: z.literal("conflict"),
  conflicts: z.array(configurationConflictSchema),
}).strict();

export const syncStatusErrorSchema = z.object({
  status: z.literal("error"),
  error: z.string(),
  lastSyncedAt: z.number().optional(),
}).strict();

export const syncStatusSchema = z.discriminatedUnion("status", [
  syncStatusSyncedSchema,
  syncStatusSyncingSchema,
  syncStatusOfflineSchema,
  syncStatusConflictSchema,
  syncStatusErrorSchema,
]);

// --- Inspection schema ---

export const configurationInspectionSchema = z.object({
  key: z.string(),
  effectiveValue: z.unknown().optional(),
  effectiveLayer: z.string().optional(),
  coreValue: z.unknown().optional(),
  appValue: z.unknown().optional(),
  moduleValue: z.unknown().optional(),
  integratorValue: z.unknown().optional(),
  tenantValue: z.unknown().optional(),
  userValue: z.unknown().optional(),
  deviceValue: z.unknown().optional(),
  sessionValue: z.unknown().optional(),
  scopeValues: z.array(
    z.object({
      scopeId: z.string(),
      value: z.unknown(),
    }).strict(),
  ).readonly().optional(),
}).strict();
