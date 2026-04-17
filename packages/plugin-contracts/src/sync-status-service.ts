// sync-status-service.ts — Public SyncStatusService contract for plugin consumption.
//
// Plugins access sync status via:
//   services.getService<SyncStatusService>('ghost.syncStatus.Service')

// ---------------------------------------------------------------------------
// SyncStatusService interface
// ---------------------------------------------------------------------------

export interface SyncStatusService {
  /** Returns true if cross-window sync is currently degraded. */
  isSyncDegraded(): boolean;
}

// ---------------------------------------------------------------------------
// Well-known service ID
// ---------------------------------------------------------------------------

/** Well-known service ID for the SyncStatusService. */
export const SYNC_STATUS_SERVICE_ID = "ghost.syncStatus.Service" as const;
