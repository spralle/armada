import type {
  ConfigSyncPushResult,
  ConfigurationConflict,
  ConfigurationLayerData,
  DurableConfigCache,
  SyncErrorMetadata,
  SyncQueuedMutation,
  ConfigSyncTransport,
} from "@ghost/config-types";
import type { LocalMutationContext, PushBatchOutcome } from "../types.js";

interface CommonArgs {
  tenantId: string;
  cache: DurableConfigCache;
  transport: ConfigSyncTransport;
  batchSize: number;
  now: () => number;
  snapshot: ConfigurationLayerData;
  pendingWrites: Map<string, unknown>;
  revisions: Map<string, string>;
  localContext: Map<string, LocalMutationContext>;
  createMutation: (
    operation: "set" | "remove",
    key: string,
    value: unknown,
    forcedBaseRevision?: string | undefined,
  ) => SyncQueuedMutation;
  conflictResolution: "server-authoritative" | "lww-fallback";
}

export interface FlushQueueArgs extends CommonArgs {
  onError: (error: SyncErrorMetadata) => Promise<void>;
}

export async function flushQueue(args: FlushQueueArgs): Promise<PushBatchOutcome> {
  let pushed = 0;
  const conflicts: ConfigurationConflict[] = [];

  while (true) {
    const queued = await args.cache.peekQueuedMutations(args.tenantId, args.batchSize);
    if (queued.length === 0) {
      return { pushed, conflicts, shouldStop: false };
    }

    const requestId = createRequestId(args.tenantId, args.now);
    await args.cache.markRequestInFlight(args.tenantId, requestId, queued.map((m) => m.mutationId));

    try {
      const response = await args.transport.push({
        tenantId: args.tenantId,
        requestId,
        mutations: queued,
      });

      const batchConflicts = await applyPushResults({
        ...args,
        results: response.results,
        attempted: queued,
      });

      pushed += response.results.filter((r) => r.accepted).length;
      conflicts.push(...batchConflicts);
      await args.cache.acknowledgeRequest(args.tenantId, requestId);
      await args.transport.ack({ tenantId: args.tenantId, requestId });
      await args.cache.setCursor(args.tenantId, {
        serverRevision: response.serverRevision,
        serverTime: response.serverTime,
      });
      args.snapshot.revision = response.serverRevision;
      args.snapshot.lastSyncedAt = response.serverTime;
      await args.cache.saveSnapshot(args.tenantId, cloneSnapshot(args.snapshot));
    } catch (error) {
      const syncError = classifySyncError(error);
      await args.cache.releaseRequest(args.tenantId, requestId, syncError);
      await args.onError(syncError);
      return { pushed, conflicts, shouldStop: true, retryableError: syncError };
    }
  }
}

interface ApplyPushArgs extends CommonArgs {
  results: ReadonlyArray<ConfigSyncPushResult>;
  attempted: ReadonlyArray<SyncQueuedMutation>;
}

async function applyPushResults(args: ApplyPushArgs): Promise<ConfigurationConflict[]> {
  const attemptedById = new Map(args.attempted.map((entry) => [entry.mutationId, entry]));
  const conflicts: ConfigurationConflict[] = [];

  for (const result of args.results) {
    const mutation = attemptedById.get(result.mutationId);
    if (mutation === undefined) {
      continue;
    }

    if (result.accepted) {
      args.pendingWrites.delete(mutation.key);
      args.localContext.delete(result.mutationId);
      if (result.revision !== undefined) {
        args.revisions.set(mutation.key, result.revision);
      }
      continue;
    }

    if (result.conflict === undefined) {
      continue;
    }

    const context = args.localContext.get(result.mutationId);
    conflicts.push({
      key: mutation.key,
      localValue: context?.localValue,
      remoteValue: result.conflict.serverValue,
      localRevision: result.conflict.localRevision ?? context?.localRevision ?? "unknown",
      remoteRevision: result.conflict.serverRevision,
    });

    if (args.conflictResolution === "server-authoritative") {
      if (result.conflict.serverValue === undefined) {
        delete args.snapshot.entries[mutation.key];
      } else {
        args.snapshot.entries[mutation.key] = result.conflict.serverValue;
      }
      args.pendingWrites.delete(mutation.key);
    } else {
      const value = context?.localValue;
      const operation = value === undefined ? "remove" : "set";
      const retryMutation = args.createMutation(
        operation,
        mutation.key,
        value,
        result.conflict.serverRevision,
      );
      args.localContext.set(retryMutation.mutationId, {
        mutation: retryMutation,
        localValue: value,
        localRevision: result.conflict.serverRevision,
      });
      await args.cache.enqueueMutation(args.tenantId, retryMutation);
    }

    args.localContext.delete(result.mutationId);
  }

  return conflicts;
}

export async function pullChanges(args: CommonArgs): Promise<number> {
  const cursor = await args.cache.getCursor(args.tenantId);
  const response = await args.transport.pull({
    tenantId: args.tenantId,
    cursor,
    limit: args.batchSize,
  });

  for (const change of response.changes) {
    if (change.operation === "remove") {
      delete args.snapshot.entries[change.key];
    } else {
      args.snapshot.entries[change.key] = change.value;
    }
    args.revisions.set(change.key, change.revision);
    if (args.conflictResolution === "server-authoritative") {
      args.pendingWrites.delete(change.key);
    }
  }

  args.snapshot.revision = response.cursor.serverRevision;
  args.snapshot.lastSyncedAt = response.serverTime;
  await args.cache.setCursor(args.tenantId, response.cursor);
  await args.cache.saveSnapshot(args.tenantId, cloneSnapshot(args.snapshot));
  return response.changes.length;
}

export function classifySyncError(error: unknown): SyncErrorMetadata {
  const syncError =
    typeof error === "object" && error !== null && "syncError" in error
      ? (error as { syncError?: unknown }).syncError
      : undefined;
  if (isSyncErrorMetadata(syncError)) {
    return syncError;
  }

  if (isSyncErrorMetadata(error)) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return {
      code: "unknown",
      message: (error as { message: string }).message,
      retryable: false,
    };
  }

  return {
    code: "unknown",
    message: typeof error === "string" && error.length > 0 ? error : "Config sync request failed.",
    retryable: false,
  };
}

const SYNC_ERROR_CODES = new Set<SyncErrorMetadata["code"]>([
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

function isSyncErrorMetadata(value: unknown): value is SyncErrorMetadata {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<SyncErrorMetadata>;
  return (
    typeof candidate.code === "string" &&
    SYNC_ERROR_CODES.has(candidate.code as SyncErrorMetadata["code"]) &&
    typeof candidate.message === "string" &&
    typeof candidate.retryable === "boolean"
  );
}

export function createMutation(
  tenantId: string,
  now: () => number,
  mutationCounter: number,
  operation: "set" | "remove",
  key: string,
  value: unknown,
  revision?: string | undefined,
): SyncQueuedMutation {
  return {
    mutationId: `${tenantId}-${now()}-${mutationCounter}`,
    tenantId,
    key,
    operation,
    value,
    baseRevision: revision,
    metadata: {
      queuedAt: now(),
      attemptCount: 0,
      policyAllowed: true,
    },
  };
}

export function createRequestId(tenantId: string, now: () => number): string {
  return `req-${tenantId}-${now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function cloneSnapshot(snapshot: ConfigurationLayerData): ConfigurationLayerData {
  return {
    entries: { ...snapshot.entries },
    revision: snapshot.revision,
    lastSyncedAt: snapshot.lastSyncedAt,
  };
}
