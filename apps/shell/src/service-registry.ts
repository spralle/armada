// ---------------------------------------------------------------------------
// Shell Service Registry
// ---------------------------------------------------------------------------
// Typed service locator for shell-level services. Services are registered
// during bootstrap and consumed by plugins via the plugin runtime API.
//
// Type safety is achieved via declaration merging on ShellServiceIdMap:
//
//   declare module "./service-registry.js" {
//     interface ShellServiceIdMap {
//       "ghost.theme.Service": ThemeService;
//     }
//   }
// ---------------------------------------------------------------------------

/**
 * Map of well-known service IDs to their concrete types.
 * Extend this interface via declaration merging when adding new shell services.
 */
export interface ShellServiceIdMap {
  // Extended via declaration merging by service registrants
}

/**
 * Union of all known service IDs. Falls back to `string` for unknown services.
 */
export type KnownServiceId = keyof ShellServiceIdMap;

// ---------------------------------------------------------------------------
// Registry interface
// ---------------------------------------------------------------------------

export interface ShellServiceRegistry {
  /**
   * Register a service implementation by ID.
   * Throws if a service with that ID is already registered.
   */
  registerService<K extends KnownServiceId>(
    id: K,
    implementation: ShellServiceIdMap[K],
  ): void;

  /**
   * Register a service with an arbitrary string ID for extensibility.
   */
  registerService(id: string, implementation: unknown): void;

  /**
   * Get a service by known ID. Returns null if not registered.
   */
  getService<K extends KnownServiceId>(id: K): ShellServiceIdMap[K] | null;

  /**
   * Get a service by arbitrary string ID.
   */
  getService<T = unknown>(id: string): T | null;

  /**
   * Check if a service is registered.
   */
  hasService(id: string): boolean;

  /**
   * List all registered service IDs.
   */
  listServiceIds(): string[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createServiceRegistry(): ShellServiceRegistry {
  const services = new Map<string, unknown>();

  return {
    registerService(id: string, implementation: unknown): void {
      if (services.has(id)) {
        throw new Error(`Service "${id}" is already registered`);
      }
      services.set(id, implementation);
    },

    getService<T = unknown>(id: string): T | null {
      return (services.get(id) as T) ?? null;
    },

    hasService(id: string): boolean {
      return services.has(id);
    },

    listServiceIds(): string[] {
      return [...services.keys()];
    },
  };
}
