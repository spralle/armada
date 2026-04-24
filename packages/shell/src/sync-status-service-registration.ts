// sync-status-service-registration.ts — SyncStatusService adapter and shell registration.

import type {
  SyncStatusService,
  PluginContract,
} from "@ghost-shell/contracts";
import { SYNC_STATUS_SERVICE_ID } from "@ghost-shell/contracts";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export const SYNC_STATUS_SERVICE_PLUGIN_ID = "ghost.shell.sync-status-service";

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface SyncStatusServiceDeps {
  isSyncDegraded: () => boolean;
}

// ---------------------------------------------------------------------------
// Adapter factory + registration
// ---------------------------------------------------------------------------

export function registerSyncStatusServiceCapability(
  registry: ShellPluginRegistry,
  deps: SyncStatusServiceDeps,
): void {
  const service: SyncStatusService = {
    isSyncDegraded(): boolean {
      return deps.isSyncDegraded();
    },
  };

  const contract: PluginContract = {
    manifest: {
      id: SYNC_STATUS_SERVICE_PLUGIN_ID,
      name: "Sync Status Service Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [
          { id: SYNC_STATUS_SERVICE_ID, version: "1.0.0" },
        ],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [SYNC_STATUS_SERVICE_ID]: service });
}
