// Inline stubs replacing deleted @weaver/* and @ghost/config-plugin-runtime packages.
// All types are structural duplicates; all runtime exports are no-ops.

export type ConfigurationRole =
  | "platform-ops" | "tenant-admin" | "scope-admin" | "integrator"
  | "user" | "support" | "system" | "service" | "platform-service";

export interface PolicyEvaluationContext {
  userId: string;
  tenantId: string;
  roles: ConfigurationRole[];
  sessionMode?: string;
  overrideReason?: string;
}

export type PolicyDecision =
  | { outcome: "allowed" }
  | { outcome: "requires-promotion"; message?: string }
  | { outcome: "requires-emergency-auth"; message?: string }
  | { outcome: "denied"; reason?: string };

export interface ConfigurationPropertySchema {
  type?: string;
  default?: unknown;
  description?: string;
  reloadBehavior?: string;
  changePolicy?: string;
}

export interface ConfigAuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  key: string;
  layer: string;
  tenantId: string;
  newValue?: unknown;
  changePolicy?: string;
  isEmergencyOverride?: boolean;
  overrideReason?: string;
}

export interface ConfigAuditLog {
  append(entry: ConfigAuditEntry): Promise<void>;
  queryByKey(key: string): Promise<ConfigAuditEntry[]>;
  queryByTimeRange(from: string, to: string): Promise<ConfigAuditEntry[]>;
  getRecent(limit?: number): Promise<ConfigAuditEntry[]>;
}

export interface OverrideRecord {
  id: string;
  key: string;
  actor: string;
  reason: string;
  tenantId: string;
  layer: string;
  createdAt: string;
  regularizedAt?: string;
  regularizedBy?: string;
}

export interface OverrideTracker {
  create(record: OverrideRecord): Promise<void>;
  listActive(): Promise<OverrideRecord[]>;
  listOverdue(): Promise<OverrideRecord[]>;
  regularize(id: string, by: string): Promise<OverrideRecord | undefined>;
}

export interface OverrideSessionController {
  activate(data: unknown): unknown;
  deactivate(): unknown;
  getSession(): unknown;
  isActive(): boolean;
}

export interface ConfigurationService {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  onChange(cb: () => void): () => void;
}

export interface ServiceConfigurationService {
  get(key: string): unknown;
}

export interface ConfigurationLayerEntry {
  layer: string;
  entries: Record<string, unknown>;
}

export interface StorageLoadResult {
  entries: Record<string, unknown>;
}

export interface StorageWriteResult {
  success: boolean;
  revision?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Runtime stubs
// ---------------------------------------------------------------------------

export class FileSystemStorageProvider {
  constructor(_opts: {
    id: string;
    layer: string;
    filePath: string;
    writable?: boolean;
    environmentOverlayPath?: string;
  }) {}

  async load(): Promise<StorageLoadResult> {
    return { entries: {} };
  }

  async write(_key: string, _value: unknown): Promise<StorageWriteResult> {
    return { success: true, revision: 0 };
  }

  async remove(_key: string): Promise<StorageWriteResult> {
    return { success: true, revision: 0 };
  }
}

export function evaluateChangePolicy(
  _schema: ConfigurationPropertySchema,
  _context: PolicyEvaluationContext,
  _layer: string,
  _canWrite: () => boolean,
): PolicyDecision {
  return { outcome: "allowed" };
}

export function resolveConfiguration(opts: {
  layers: ConfigurationLayerEntry[];
}): { entries: Record<string, unknown> } {
  const entries: Record<string, unknown> = {};
  for (const layer of opts.layers) {
    Object.assign(entries, layer.entries);
  }
  return { entries };
}

export function inspectKey(
  opts: { layers: ConfigurationLayerEntry[] },
  key: string,
): { effectiveValue: unknown } {
  let effectiveValue: unknown;
  for (const layer of opts.layers) {
    if (key in layer.entries) {
      effectiveValue = layer.entries[key];
    }
  }
  return { effectiveValue };
}

export function createInMemoryAuditLog(): ConfigAuditLog {
  return {
    async append() {},
    async queryByKey() { return []; },
    async queryByTimeRange() { return []; },
    async getRecent() { return []; },
  };
}

export function createInMemoryOverrideTracker(): OverrideTracker {
  return {
    async create() {},
    async listActive() { return []; },
    async listOverdue() { return []; },
    async regularize() { return undefined; },
  };
}

export function createOverrideSessionProvider(): OverrideSessionController {
  return {
    isActive() { return false; },
    activate(_data: unknown) { return { active: true }; },
    deactivate() { return { active: false }; },
    getSession() { return null; },
  };
}

export async function createConfigurationService(
  _opts: unknown,
): Promise<ConfigurationService> {
  return {
    get() { return undefined; },
    set() {},
    onChange() { return () => {}; },
  };
}

export function createServiceConfigurationService(
  _opts: unknown,
): ServiceConfigurationService {
  return { get() { return undefined; } };
}

export const sessionActivationRequestSchema = {
  safeParse(data: unknown): { success: true; data: unknown } | { success: false; error: { issues: unknown[] } } {
    return { success: true, data };
  },
};

export const armadaWeaver = undefined;
