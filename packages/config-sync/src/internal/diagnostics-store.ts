import type { SyncStatus } from "@ghost/config-types";
import type { SyncDiagnostics } from "../types.js";

export type SyncStateListener = (state: SyncStatus) => void;
export type DiagnosticsListener = (diagnostics: SyncDiagnostics) => void;

export class DiagnosticsStore {
  private syncState: SyncStatus = { status: "syncing" };
  private diagnostics: SyncDiagnostics;
  private readonly stateListeners = new Set<SyncStateListener>();
  private readonly diagnosticsListeners = new Set<DiagnosticsListener>();

  constructor(initial: SyncDiagnostics) {
    this.diagnostics = initial;
  }

  getSyncState(): SyncStatus {
    return this.syncState;
  }

  getDiagnostics(): SyncDiagnostics {
    return {
      ...this.diagnostics,
      queue: { ...this.diagnostics.queue },
    };
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
      queue: partial.queue === undefined ? this.diagnostics.queue : { ...partial.queue },
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
