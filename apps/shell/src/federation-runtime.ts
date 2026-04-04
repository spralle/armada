import {
  createInstance,
  type ModuleFederation,
} from "@module-federation/enhanced/runtime";

type RuntimeCreateOptions = Parameters<typeof createInstance>[0];

/**
 * Keep shell/plugin contracts singleton-safe by preferring the already loaded
 * host instance across remotes. This is a lightweight runtime-only strategy
 * for POC work; no bundler plugin wiring is required here.
 */
const SHARED_DEPENDENCIES: NonNullable<RuntimeCreateOptions["shared"]> = {
  "@armada/plugin-contracts": {
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
  loadPluginContract(remoteId: string): Promise<unknown>;
}

export function createShellFederationRuntime(): ShellFederationRuntime {
  const host = createInstance({
    name: "armada_shell",
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
    async loadPluginContract(remoteId) {
      const contract = await host.loadRemote<unknown>(`${remoteId}/pluginContract`);
      return contract;
    },
  };
}

export function isModuleFederationRuntimeInstance(value: unknown): value is ModuleFederation {
  return Boolean(value) && typeof value === "object" && "loadRemote" in (value as object);
}
