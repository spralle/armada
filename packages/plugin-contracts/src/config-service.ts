// config-service.ts — Well-known service ID for the ConfigurationService.
//
// Plugins access configuration via:
//   services.getService<ConfigurationService>(CONFIG_SERVICE_ID)

/** Well-known service ID for the ConfigurationService capability. */
export const CONFIG_SERVICE_ID = "ghost.configuration.Service" as const;
