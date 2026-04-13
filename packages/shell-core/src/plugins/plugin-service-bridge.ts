import type { PluginServices } from "@ghost-shell/plugin-contracts";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export function createPluginServicesBridge(
  registry: ShellPluginRegistry,
): PluginServices {
  return {
    getService<T = unknown>(id: string): T | null {
      return registry.getService<T>(id);
    },
    hasService(id: string): boolean {
      return registry.hasService(id);
    },
  };
}
