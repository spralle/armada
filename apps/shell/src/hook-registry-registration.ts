import type { PluginContract } from "@ghost/plugin-contracts";
import { HOOK_REGISTRY_SERVICE_ID } from "@ghost/plugin-contracts";
import { HookRegistry } from "./hook-registry.js";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export const HOOK_REGISTRY_PLUGIN_ID = "ghost.shell.hook-registry";

/**
 * Create a HookRegistry and register it as a builtin plugin capability.
 * Returns the registry instance so the shell can query hooks internally.
 */
export function registerHookRegistryCapability(
  registry: ShellPluginRegistry,
): HookRegistry {
  const hookRegistry = new HookRegistry();

  const contract: PluginContract = {
    manifest: {
      id: HOOK_REGISTRY_PLUGIN_ID,
      name: "Hook Registry Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [
          { id: HOOK_REGISTRY_SERVICE_ID, version: "1.0.0" },
        ],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [HOOK_REGISTRY_SERVICE_ID]: hookRegistry });
  return hookRegistry;
}
