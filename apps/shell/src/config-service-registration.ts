// config-service-registration.ts — ConfigurationService shell registration.
//
// Registers the ConfigurationService as a builtin plugin capability,
// following the same pattern as theme-service-registration.ts.

// @weaver/config-types, @weaver/config-providers, @weaver/config-engine removed.
// Stub types and throwing stubs preserve the public API.

/** Stub for ConfigurationService (@weaver/config-types removed). */
interface ConfigurationService {
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown, layer?: string): void;
  [key: string]: unknown;
}

import type { PluginContract } from "@ghost-shell/contracts";
import { CONFIG_SERVICE_ID } from "@ghost-shell/contracts";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export const CONFIG_SERVICE_PLUGIN_ID = "ghost.shell.config-service";

// @weaver/config-providers removed — stub throws so shell fallback path runs
function createScopedConfigurationService(..._args: unknown[]): never {
  throw new Error("@weaver/config-providers is not available");
}

// @weaver/config-engine removed — stub throws so shell fallback path runs
function deriveNamespace(..._args: unknown[]): never {
  throw new Error("@weaver/config-engine is not available");
}

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
