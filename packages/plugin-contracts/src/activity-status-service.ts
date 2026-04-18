// activity-status-service.ts — Public ActivityStatusService contract for plugin consumption.
//
// Plugins access activity status via:
//   services.getService<ActivityStatusService>('ghost.activityStatus.Service')

// ---------------------------------------------------------------------------
// ActivityToken interface
// ---------------------------------------------------------------------------

export interface ActivityToken {
  dispose(): void;
}

// ---------------------------------------------------------------------------
// ActivityStatusService interface
// ---------------------------------------------------------------------------

export interface ActivityStatusService {
  /** Start an activity. Returns a token — call dispose() to end it. */
  startActivity(label?: string): ActivityToken;
  /** Number of currently active activities. */
  readonly activityCount: number;
  /** Subscribe to activity count changes. */
  onDidChange(listener: (count: number) => void): { dispose(): void };
  /** Convenience: run an async function wrapped in an activity token. */
  withActivity<T>(fn: () => Promise<T>, label?: string): Promise<T>;
}

// ---------------------------------------------------------------------------
// Well-known service ID
// ---------------------------------------------------------------------------

/** Well-known service ID for the ActivityStatusService. */
export const ACTIVITY_STATUS_SERVICE_ID = "ghost.activityStatus.Service" as const;
