// plugin-registry-service-registration.ts — PluginRegistryService adapter and shell registration.

import type {
  PluginRegistryService,
  PluginRegistryServiceSnapshot,
  PluginContract,
} from "@ghost/plugin-contracts";
import { PLUGIN_REGISTRY_SERVICE_ID } from "@ghost/plugin-contracts";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export const PLUGIN_REGISTRY_SERVICE_PLUGIN_ID = "ghost.shell.plugin-registry-service";

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface PluginRegistryServiceDeps {
  registry: ShellPluginRegistry;
  getPluginNotice: () => string;
}

// ---------------------------------------------------------------------------
// Adapter factory + registration
// ---------------------------------------------------------------------------

export function registerPluginRegistryServiceCapability(
  registry: ShellPluginRegistry,
  deps: PluginRegistryServiceDeps,
): void {
  const service: PluginRegistryService = {
    getSnapshot(): PluginRegistryServiceSnapshot {
      const snap = deps.registry.getSnapshot();
      return {
        tenantId: snap.tenantId || null,
        plugins: snap.plugins.map((p) => ({
          pluginId: p.id,
          name: p.contract?.manifest?.name ?? p.descriptor?.id ?? p.id,
          enabled: p.enabled,
          status: p.lifecycle.state,
        })),
      };
    },

    getPluginNotice(): string | null {
      const notice = deps.getPluginNotice();
      return notice || null;
    },
  };

  const contract: PluginContract = {
    manifest: {
      id: PLUGIN_REGISTRY_SERVICE_PLUGIN_ID,
      name: "Plugin Registry Service Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [
          { id: PLUGIN_REGISTRY_SERVICE_ID, version: "1.0.0" },
        ],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [PLUGIN_REGISTRY_SERVICE_ID]: service });
}
