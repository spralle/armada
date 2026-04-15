import type { SyncQueueMetadata, SyncStatus } from "@ghost/config-types";
import type { SyncDiagnostics } from "../types.js";

export type SyncStateListener = (state: SyncStatus) => void;
export type DiagnosticsListener = (diagnostics: SyncDiagnostics) => void;

export class DiagnosticsStore {
  private syncState: SyncStatus = { status: "syncing" };
  private diagnostics: SyncDiagnostics;
  private queue: SyncQueueMetadata;
  private readonly stateListeners = new Set<SyncStateListener>();
  private readonly diagnosticsListeners = new Set<DiagnosticsListener>();

  constructor(initial: { diagnostics: SyncDiagnostics; queue: SyncQueueMetadata }) {
    this.diagnostics = initial.diagnostics;
    this.queue = { ...initial.queue };
  }

  getSyncState(): SyncStatus {
    return this.syncState;
  }

  getDiagnostics(): SyncDiagnostics {
    return { ...this.diagnostics };
  }

  setQueue(next: SyncQueueMetadata): void {
    this.queue = { ...next };
  }

  getPendingWriteCount(): number {
    return this.queue.pendingCount + this.queue.inFlightCount;
  }

  setSyncState(next: SyncStatus): void {
    this.syncState = next;
    for (const listener of this.stateListeners) {
      listener(next);
    }
  }

  updateDiagnostics(partial: Partial<SyncDiagnostics>): void {
    this.diagnostics = {
      ...this.diagnostics,
      ...partial,
    };
    const current = this.getDiagnostics();
    for (const listener of this.diagnosticsListeners) {
      listener(current);
    }
  }

  onSyncStateChange(listener: SyncStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onDiagnosticsChange(listener: DiagnosticsListener): () => void {
    this.diagnosticsListeners.add(listener);
    return () => this.diagnosticsListeners.delete(listener);
  }
}
