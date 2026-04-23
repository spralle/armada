/**
 * Shared utilities for Module Federation mount/unmount lifecycle.
 * Used by both part-module-host (dock parts) and edge-slot-renderer (slot components).
 */

/** Cleanup returned by a mount function — can be a function, object with unmount(), or void. */
export type MountCleanup = (() => void) | { unmount?: () => void } | void;

/** Normalize any mount cleanup into a plain function or null. */
export function normalizeCleanup(cleanup: MountCleanup): (() => void) | null {
  if (typeof cleanup === "function") {
    return cleanup;
  }

  if (cleanup && typeof cleanup === "object" && "unmount" in cleanup) {
    const unmount = cleanup.unmount;
    if (typeof unmount === "function") {
      return () => {
        unmount();
      };
    }
  }

  return null;
}

/** Safely call a cleanup function, catching errors. */
export function safeUnmount(cleanup: (() => void) | null): void {
  if (!cleanup) {
    return;
  }

  try {
    cleanup();
  } catch {
    // Ignore cleanup errors to preserve host resilience.
  }
}

/** Safely cast an unknown value to a Record for property access. */
export function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

/**
 * Ensure a plugin's remote entry is registered with the federation runtime.
 * Idempotent — skips if already registered.
 */
export function ensureRemoteRegistered(
  pluginId: string,
  registeredRemoteIds: Set<string>,
  getDescriptor: () => { id: string; entry: string } | undefined,
  registerRemote: (descriptor: { id: string; entry: string }) => void,
): void {
  if (registeredRemoteIds.has(pluginId)) {
    return;
  }

  const descriptor = getDescriptor();
  if (descriptor) {
    registerRemote(descriptor);
    registeredRemoteIds.add(pluginId);
  }
}
