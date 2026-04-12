import type { ConfigurationLayer, ConfigurationLayerData } from "./types.js";

export interface WriteResult {
  success: boolean;
  error?: string | undefined;
  revision?: string | undefined;
}

export interface ConfigurationChange {
  key: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ConfigurationStorageProvider {
  readonly id: string;
  readonly layer: ConfigurationLayer | string;
  readonly writable: boolean;
  load(): Promise<ConfigurationLayerData>;
  write(key: string, value: unknown): Promise<WriteResult>;
  remove(key: string): Promise<WriteResult>;
  onExternalChange?(listener: (changes: ConfigurationChange[]) => void): () => void;
}

export type SyncStatus =
  | { status: "synced"; lastSyncedAt: number }
  | { status: "syncing" }
  | { status: "offline"; lastSyncedAt: number; pendingWriteCount: number }
  | { status: "conflict"; conflicts: ConfigurationConflict[] }
  | { status: "error"; error: string; lastSyncedAt?: number | undefined };

export interface ConfigurationConflict {
  key: string;
  localValue: unknown;
  remoteValue: unknown;
  localRevision: string;
  remoteRevision: string;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: ConfigurationConflict[];
}

export interface SyncableStorageProvider extends ConfigurationStorageProvider {
  readonly syncState: SyncStatus;
  readonly pendingWrites: ReadonlyMap<string, unknown>;
  sync(): Promise<SyncResult>;
  onSyncStateChange(listener: (state: SyncStatus) => void): () => void;
}
