// config-service-registration.ts — ConfigurationService shell registration.
//
// Registers the ConfigurationService as a builtin plugin capability,
// following the same pattern as theme-service-registration.ts.

import type { ConfigurationService } from "@weaver/config-types";
import type { PluginContract } from "@ghost/plugin-contracts";
import { CONFIG_SERVICE_ID } from "@ghost/plugin-contracts";
import { createScopedConfigurationService } from "@weaver/config-providers";
import { deriveNamespace } from "@weaver/config-engine";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export const CONFIG_SERVICE_PLUGIN_ID = "ghost.shell.config-service";

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register the ConfigurationService as a builtin plugin capability.
 * Follows the same pattern as registerThemeServiceCapability.
 */
export function registerConfigurationServiceCapability(
  registry: ShellPluginRegistry,
  configService: ConfigurationService,
): void {
  const contract: PluginContract = {
    manifest: {
      id: CONFIG_SERVICE_PLUGIN_ID,
      name: "Configuration Service Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [
          { id: CONFIG_SERVICE_ID, version: "1.0.0" },
        ],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [CONFIG_SERVICE_ID]: configService });
}

// ---------------------------------------------------------------------------
// Scoped service factory for plugin activation
// ---------------------------------------------------------------------------

/**
 * Create a ScopedConfigurationService for a plugin.
 * Called during plugin activation to give each plugin namespace-scoped
 * config access.
 */
export function createScopedServiceForPlugin(
  configService: ConfigurationService,
  pluginId: string,
): ReturnType<typeof createScopedConfigurationService> {
  const namespace = deriveNamespace(pluginId);
  return createScopedConfigurationService(configService, namespace);
}
