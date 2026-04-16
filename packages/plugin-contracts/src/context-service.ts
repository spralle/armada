// context-service.ts — Public ContextService contract for plugin consumption.
//
// Plugins access group selection context via:
//   services.getService<ContextService>('ghost.context.Service')

// ---------------------------------------------------------------------------
// ContextService interface
// ---------------------------------------------------------------------------

export interface ContextService {
  /** Get the current group selection context as key-value pairs. */
  getGroupSelectionContext(): Record<string, string>;

  /** Apply a context value by key. */
  applyContextValue(key: string, value: string): void;
}

// ---------------------------------------------------------------------------
// Well-known service ID
// ---------------------------------------------------------------------------

/** Well-known service ID for the ContextService. */
export const CONTEXT_SERVICE_ID = "ghost.context.Service" as const;
