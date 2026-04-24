// config-service.ts — Well-known service ID for the ConfigurationService.
//
// Plugins access configuration via:
//   services.getService<ConfigurationService>(CONFIG_SERVICE_ID)

/** Well-known service ID for the ConfigurationService capability. */
export const CONFIG_SERVICE_ID = "ghost.configuration.Service" as const;

/**
 * Stub interface for ConfigurationService (@weaver/config-types removed).
 * Canonical definition — import from `@ghost-shell/contracts` instead of
 * re-declaring locally.
 */
export interface ConfigurationService {
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown, layer?: string): void;
  onChange(key: string, listener: (value: unknown) => void): () => void;
  [key: string]: unknown;
}
