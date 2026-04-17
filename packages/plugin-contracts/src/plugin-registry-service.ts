// plugin-registry-service.ts — Public PluginRegistryService contract for plugin consumption.
//
// Plugins access registry state via:
//   services.getService<PluginRegistryService>('ghost.pluginRegistry.Service')

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Simplified plugin entry visible to consumers. */
export interface PluginRegistryEntry {
  pluginId: string;
  name: string;
  enabled: boolean;
  status: string;
}

/** Simplified registry snapshot visible to consumers. */
export interface PluginRegistrySnapshot {
  tenantId: string | null;
  plugins: PluginRegistryEntry[];
}

// ---------------------------------------------------------------------------
// PluginRegistryService interface
// ---------------------------------------------------------------------------

export interface PluginRegistryService {
  /** Get a simplified snapshot of the current plugin registry state. */
  getSnapshot(): PluginRegistrySnapshot;

  /** Get the current plugin notice message, or null if none. */
  getPluginNotice(): string | null;
}

// ---------------------------------------------------------------------------
// Well-known service ID
// ---------------------------------------------------------------------------

/** Well-known service ID for the PluginRegistryService. */
export const PLUGIN_REGISTRY_SERVICE_ID = "ghost.pluginRegistry.Service" as const;
