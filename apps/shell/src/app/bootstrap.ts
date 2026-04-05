import type { PluginContract } from "@armada/plugin-contracts";
import { createShellPluginRegistry } from "../plugin-registry.js";
import type {
  ShellBootstrapOptions,
  ShellBootstrapState,
} from "./types.js";
import { parseTenantManifestFallback } from "./utils.js";

async function fetchManifestFromEndpoint(manifestUrl: string): Promise<unknown> {
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch tenant manifest from '${manifestUrl}' (${response.status})`);
  }

  return response.json();
}

export async function bootstrapShellWithTenantManifest(
  options: ShellBootstrapOptions,
): Promise<ShellBootstrapState> {
  const tenantId = options.tenantId.trim();
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const manifestUrl = `/api/tenants/${encodeURIComponent(tenantId)}/plugin-manifest`;
  const fetchManifest = options.fetchManifest ?? fetchManifestFromEndpoint;
  const rawManifest = await fetchManifest(manifestUrl);
  const parsedManifest = parseTenantManifestFallback(rawManifest);

  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors(parsedManifest.tenantId, parsedManifest.plugins);

  if (options.enableByDefault) {
    for (const descriptor of parsedManifest.plugins) {
      await registry.setEnabled(descriptor.id, true);
    }
  }

  const snapshot = registry.getSnapshot();

  return {
    mode: parsedManifest.plugins.some((plugin) => !plugin.entry.startsWith("local://"))
      ? "integration"
      : "inner-loop",
    loadedPlugins: snapshot.plugins
      .map((plugin) => plugin.contract)
      .filter((plugin): plugin is PluginContract => plugin !== null),
    registry,
  };
}

const emptyRegistry = createShellPluginRegistry();
emptyRegistry.registerManifestDescriptors("local", []);

export const shellBootstrapState: ShellBootstrapState = {
  mode: "inner-loop",
  loadedPlugins: [],
  registry: emptyRegistry,
};
