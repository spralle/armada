import type { PluginContract, TenantPluginDescriptor } from "@armada/plugin-contracts";
import {
  createRuntimeFirstPluginLoader,
  type RuntimeFirstPluginLoader,
  type ShellPluginLoadMode,
} from "./plugin-loader.js";

interface PluginRuntimeState {
  descriptor: TenantPluginDescriptor;
  enabled: boolean;
  loadMode: ShellPluginLoadMode;
  contract: PluginContract | null;
}

export interface PluginRegistrySnapshot {
  tenantId: string;
  plugins: {
    id: string;
    enabled: boolean;
    loadMode: ShellPluginLoadMode;
    descriptor: TenantPluginDescriptor;
    contract: PluginContract | null;
  }[];
}

export interface ShellPluginRegistry {
  registerManifestDescriptors(tenantId: string, descriptors: TenantPluginDescriptor[]): void;
  setEnabled(pluginId: string, enabled: boolean): Promise<void>;
  getSnapshot(): PluginRegistrySnapshot;
}

export interface ShellPluginRegistryOptions {
  pluginLoader?: RuntimeFirstPluginLoader;
}

export function createShellPluginRegistry(
  options: ShellPluginRegistryOptions = {},
): ShellPluginRegistry {
  const pluginLoader = options.pluginLoader ?? createRuntimeFirstPluginLoader();
  const states = new Map<string, PluginRuntimeState>();
  let tenantId = "local";

  return {
    registerManifestDescriptors(nextTenantId, descriptors) {
      tenantId = nextTenantId;
      states.clear();
      for (const descriptor of descriptors) {
        states.set(descriptor.id, {
          descriptor,
          enabled: false,
          loadMode: pluginLoader.loadModeFor(descriptor),
          contract: null,
        });
      }
    },
    async setEnabled(pluginId, enabled) {
      const state = states.get(pluginId);
      if (!state) {
        throw new Error(`Plugin '${pluginId}' is not in registry`);
      }

      state.enabled = enabled;
      if (!enabled) {
        state.contract = null;
        return;
      }

      state.contract = await pluginLoader.loadPluginContract(state.descriptor);
    },
    getSnapshot() {
      return {
        tenantId,
        plugins: Array.from(states.entries()).map(([id, state]) => ({
          id,
          enabled: state.enabled,
          loadMode: state.loadMode,
          descriptor: state.descriptor,
          contract: state.contract,
        })),
      };
    },
  };
}
