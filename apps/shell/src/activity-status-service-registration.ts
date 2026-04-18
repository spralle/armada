// activity-status-service-registration.ts — ActivityStatusService implementation and shell registration.

import type {
  ActivityStatusService,
  ActivityToken,
  PluginContract,
} from "@ghost/plugin-contracts";
import { ACTIVITY_STATUS_SERVICE_ID } from "@ghost/plugin-contracts";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export const ACTIVITY_STATUS_SERVICE_PLUGIN_ID = "ghost.shell.activity-status-service";

const LEAK_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Implementation + registration
// ---------------------------------------------------------------------------

export function registerActivityStatusServiceCapability(
  registry: ShellPluginRegistry,
): void {
  const activeTokens = new Map<symbol, string>();
  const listeners = new Set<(count: number) => void>();

  function fireListeners(): void {
    const count = activeTokens.size;
    for (const listener of listeners) {
      listener(count);
    }
  }

  const service: ActivityStatusService = {
    startActivity(label?: string): ActivityToken {
      const key = Symbol(label);
      activeTokens.set(key, label ?? "");
      const wasPreviouslyEmpty = activeTokens.size === 1;
      if (wasPreviouslyEmpty) {
        fireListeners();
      }

      let disposed = false;
      const timer = setTimeout(() => {
        if (!disposed) {
          console.warn("ActivityStatusService: leaked activity token", label);
          dispose();
        }
      }, LEAK_TIMEOUT_MS);

      function dispose(): void {
        if (disposed) return;
        disposed = true;
        clearTimeout(timer);
        activeTokens.delete(key);
        if (activeTokens.size === 0) {
          fireListeners();
        }
      }

      return { dispose };
    },

    get activityCount(): number {
      return activeTokens.size;
    },

    onDidChange(listener: (count: number) => void): { dispose(): void } {
      listeners.add(listener);
      return {
        dispose(): void {
          listeners.delete(listener);
        },
      };
    },

    async withActivity<T>(fn: () => Promise<T>, label?: string): Promise<T> {
      const token = service.startActivity(label);
      try {
        return await fn();
      } finally {
        token.dispose();
      }
    },
  };

  const contract: PluginContract = {
    manifest: {
      id: ACTIVITY_STATUS_SERVICE_PLUGIN_ID,
      name: "Activity Status Service Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [
          { id: ACTIVITY_STATUS_SERVICE_ID, version: "1.0.0" },
        ],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [ACTIVITY_STATUS_SERVICE_ID]: service });
}
