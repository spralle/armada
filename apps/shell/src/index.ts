import {
  parseTenantPluginManifest,
  type PluginContract,
  type TenantPluginDescriptor,
} from "@armada/plugin-contracts";

export interface ShellBootstrapState {
  mode: "inner-loop" | "integration";
  loadedPlugins: PluginContract[];
  registry: TenantPluginRegistry;
}

export interface TenantPluginRegistry {
  tenantId: string;
  byId: Record<string, TenantPluginDescriptor>;
}

export interface ShellBootstrapOptions {
  tenantId: string;
  fetchManifest?: (manifestUrl: string) => Promise<unknown>;
}

function createRegistry(tenantId: string, plugins: TenantPluginDescriptor[]): TenantPluginRegistry {
  return {
    tenantId,
    byId: Object.fromEntries(plugins.map((plugin) => [plugin.id, plugin])),
  };
}

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
  const parsedManifest = parseTenantPluginManifest(rawManifest);

  if (!parsedManifest.success) {
    const details = parsedManifest.errors
      .map((error) => `${error.path || "<root>"}: ${error.message}`)
      .join("; ");
    throw new Error(`Invalid tenant manifest response from '${manifestUrl}': ${details}`);
  }

  return {
    mode: "integration",
    loadedPlugins: [],
    registry: createRegistry(parsedManifest.data.tenantId, parsedManifest.data.plugins),
  };
}

export const shellBootstrapState: ShellBootstrapState = {
  mode: "inner-loop",
  loadedPlugins: [],
  registry: createRegistry("local", []),
};

console.log("[shell] POC shell stub ready", shellBootstrapState.mode);
