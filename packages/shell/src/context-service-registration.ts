// context-service-registration.ts — ContextService adapter and shell registration.

import type {
  ContextService,
  PluginContract,
} from "@ghost-shell/contracts";
import { CONTEXT_SERVICE_ID } from "@ghost-shell/contracts";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export const CONTEXT_SERVICE_PLUGIN_ID = "ghost.shell.context-service";

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface ContextServiceDeps {
  getGroupSelectionContext: () => string;
  applyContextValue: (key: string, value: string) => void;
}

// ---------------------------------------------------------------------------
// Adapter factory + registration
// ---------------------------------------------------------------------------

export function registerContextServiceCapability(
  registry: ShellPluginRegistry,
  deps: ContextServiceDeps,
): void {
  const service: ContextService = {
    getGroupSelectionContext(): Record<string, string> {
      return { selection: deps.getGroupSelectionContext() };
    },

    applyContextValue(key: string, value: string): void {
      deps.applyContextValue(key, value);
    },
  };

  const contract: PluginContract = {
    manifest: {
      id: CONTEXT_SERVICE_PLUGIN_ID,
      name: "Context Service Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [
          { id: CONTEXT_SERVICE_ID, version: "1.0.0" },
        ],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [CONTEXT_SERVICE_ID]: service });
}
