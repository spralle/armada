import {
  createInstance,
  type ModuleFederation,
} from "@module-federation/enhanced/runtime";
import * as pluginContracts from "@ghost/plugin-contracts";
import * as ghostUi from "@ghost/ui";

type RuntimeCreateOptions = Parameters<typeof createInstance>[0];

/**
 * Keep shell/plugin contracts singleton-safe by preferring the already loaded
 * host instance across remotes. We provide each shared module via `lib` so the
 * runtime host can seed the MF shared scope — without a bundler plugin the
 * scope would otherwise be empty and remotes would resolve `undefined`.
 */
const SHARED_DEPENDENCIES: NonNullable<RuntimeCreateOptions["shared"]> = {
  "@ghost/plugin-contracts": {
    version: "0.0.0",
    lib: () => pluginContracts,
    shareConfig: {
      singleton: true,
      requiredVersion: "^0.0.0",
      strictVersion: false,
    },
    strategy: "loaded-first",
  },
  "@ghost/ui": {
    version: "0.0.0",
    lib: () => ghostUi,
    shareConfig: {
      singleton: true,
      requiredVersion: "^0.0.0",
      strictVersion: false,
    },
    strategy: "loaded-first",
  },
};

export interface ShellFederationRuntime {
  registerRemote(descriptor: { id: string; entry: string }): void;
  loadRemoteModule(remoteId: string, exposeKey: string): Promise<unknown>;
  loadPluginContract(remoteId: string): Promise<unknown>;
  loadPluginComponents(remoteId: string): Promise<unknown>;
  loadPluginServices(remoteId: string): Promise<unknown>;
}

export function createShellFederationRuntime(): ShellFederationRuntime {
  const host = createInstance({
    name: "ghost_shell",
    remotes: [],
    shared: SHARED_DEPENDENCIES,
    shareStrategy: "loaded-first",
  });

  return {
    registerRemote(descriptor) {
      host.registerRemotes([
        {
          name: descriptor.id,
          entry: descriptor.entry,
        },
      ]);
    },
    async loadRemoteModule(remoteId, exposeKey) {
      const normalizedExposeKey = exposeKey.startsWith("./")
        ? exposeKey.slice(2)
        : exposeKey;
      return host.loadRemote<unknown>(`${remoteId}/${normalizedExposeKey}`);
    },
    async loadPluginContract(remoteId) {
      const contract = await this.loadRemoteModule(remoteId, "./pluginContract");
      return contract;
    },
    async loadPluginComponents(remoteId) {
      const components = await host.loadRemote<unknown>(`${remoteId}/pluginComponents`);
      return components;
    },
    async loadPluginServices(remoteId) {
      const services = await host.loadRemote<unknown>(`${remoteId}/pluginServices`);
      return services;
    },
  };
}

export function isModuleFederationRuntimeInstance(value: unknown): value is ModuleFederation {
  return Boolean(value) && typeof value === "object" && "loadRemote" in (value as object);
}
