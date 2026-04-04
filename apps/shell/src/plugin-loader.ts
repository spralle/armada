import {
  parsePluginContract,
  type PluginContract,
  type TenantPluginDescriptor,
} from "@armada/plugin-contracts";
import {
  createShellFederationRuntime,
  type ShellFederationRuntime,
} from "./federation-runtime.js";
import {
  resolveLocalPluginContractLoader,
  type LocalPluginContractLoader,
} from "./local-plugin-sources.js";

export type ShellPluginLoadMode = "local-source" | "remote-manifest";

export interface RuntimeFirstPluginLoader {
  loadModeFor(descriptor: TenantPluginDescriptor): ShellPluginLoadMode;
  loadPluginContract(descriptor: TenantPluginDescriptor): Promise<PluginContract>;
}

export interface RuntimeFirstPluginLoaderOptions {
  federationRuntime?: ShellFederationRuntime;
  resolveLocalLoader?: (pluginId: string) => LocalPluginContractLoader | null;
}

export function createRuntimeFirstPluginLoader(
  options: RuntimeFirstPluginLoaderOptions = {},
): RuntimeFirstPluginLoader {
  const federationRuntime = options.federationRuntime ?? createShellFederationRuntime();
  const localResolver = options.resolveLocalLoader ?? resolveLocalPluginContractLoader;

  return {
    loadModeFor(descriptor) {
      return descriptor.entry.startsWith("local://") ? "local-source" : "remote-manifest";
    },
    async loadPluginContract(descriptor) {
      const mode = descriptor.entry.startsWith("local://") ? "local-source" : "remote-manifest";

      if (mode === "local-source") {
        const localLoader = localResolver(descriptor.id);
        if (!localLoader) {
          throw new Error(`No local plugin source mapped for '${descriptor.id}'`);
        }

        return localLoader();
      }

      federationRuntime.registerRemote({ id: descriptor.id, entry: descriptor.entry });
      const rawContract = await federationRuntime.loadPluginContract(descriptor.id);
      const parsed = parsePluginContract(rawContract);

      if (!parsed.success) {
        const details = parsed.errors
          .map((error) => `${error.path || "<root>"}: ${error.message}`)
          .join("; ");
        throw new Error(`Remote plugin '${descriptor.id}' returned invalid contract: ${details}`);
      }

      return parsed.data;
    },
  };
}
