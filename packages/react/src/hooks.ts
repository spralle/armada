import { useContext } from "react";
import { GhostContext, type GhostContextValue } from "./ghost-context.js";

/**
 * Access the full GhostContextValue. Throws if called outside a GhostProvider.
 */
export function useGhostApi(): GhostContextValue {
  const ctx = useContext(GhostContext);
  if (!ctx) {
    throw new Error(
      "useGhostApi must be used within a <GhostProvider>. " +
        "Ensure your component is rendered by the ghost-shell React renderer.",
    );
  }
  return ctx;
}

/**
 * Get a service by ID from the mount context's runtime service registry.
 * Returns undefined if the service is not registered.
 */
export function useService<T>(serviceId: string): T | undefined {
  const { mountContext } = useGhostApi();
  return (mountContext.runtime.services.getService<T>(serviceId) ?? undefined) as
    | T
    | undefined;
}

/**
 * Convenience hook for accessing plugin identity from context.
 */
export function usePluginContext(): { pluginId: string; partId: string } {
  const { pluginId, partId } = useGhostApi();
  return { pluginId, partId };
}

/**
 * Factory for creating typed service hooks.
 * Returns a hook that retrieves a specific service by its well-known ID.
 */
export function createServiceHook<T>(
  serviceId: string,
): () => T | undefined {
  return function useTypedService(): T | undefined {
    return useService<T>(serviceId);
  };
}
