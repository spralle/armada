// plugin-management-service.ts — Public PluginManagementService contract for plugin consumption.
//
// Plugins access plugin management via:
//   services.getService<PluginManagementService>('ghost.pluginManagement.Service')

// ---------------------------------------------------------------------------
// PluginManagementService interface
// ---------------------------------------------------------------------------

export interface PluginManagementService {
  /** Toggle a plugin's enabled state. */
  togglePlugin(pluginId: string, enabled: boolean): void;

  /** Activate a plugin by ID. Returns true if activation succeeded. */
  activatePlugin(pluginId: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Well-known service ID
// ---------------------------------------------------------------------------

/** Well-known service ID for the PluginManagementService. */
export const PLUGIN_MANAGEMENT_SERVICE_ID = "ghost.pluginManagement.Service" as const;
