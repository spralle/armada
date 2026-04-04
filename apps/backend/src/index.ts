interface TenantPluginDescriptor {
  id: string;
  version: string;
  entry: string;
  compatibility: {
    shell: string;
    pluginContract: string;
  };
}

interface TenantPluginManifestResponse {
  tenantId: string;
  plugins: TenantPluginDescriptor[];
}

const DEFAULT_TENANT = "demo";

const inMemoryTenantPluginDescriptors: Readonly<Record<string, TenantPluginDescriptor[]>> = {
  demo: [
    {
      id: "com.armada.plugin-starter",
      version: "0.1.0",
      entry: "local://apps/plugin-starter/src/index.ts",
      compatibility: {
        shell: "^1.0.0",
        pluginContract: "^1.0.0",
      },
    },
    {
      id: "com.armada.sample.contract-consumer",
      version: "0.1.0",
      entry: "local://apps/sample-contract-consumer-plugin/src/index.ts",
      compatibility: {
        shell: "^1.0.0",
        pluginContract: "^1.0.0",
      },
    },
    {
      id: "com.armada.domain.unplanned-orders",
      version: "0.1.0",
      entry: "local://apps/shell/src/local-plugin-sources.ts#unplanned-orders",
      compatibility: {
        shell: "^1.0.0",
        pluginContract: "^1.0.0",
      },
    },
    {
      id: "com.armada.domain.vessel-view",
      version: "0.1.0",
      entry: "local://apps/shell/src/local-plugin-sources.ts#vessel-view",
      compatibility: {
        shell: "^1.0.0",
        pluginContract: "^1.0.0",
      },
    },
  ],
};

export function getTenantManifestEndpointPath(tenantId: string): string {
  return `/api/tenants/${encodeURIComponent(tenantId)}/plugin-manifest`;
}

export function getTenantManifestResponse(tenantId: string): TenantPluginManifestResponse {
  const normalizedTenantId = tenantId.trim() || DEFAULT_TENANT;
  const plugins = inMemoryTenantPluginDescriptors[normalizedTenantId] ?? [];

  return {
    tenantId: normalizedTenantId,
    plugins,
  };
}

export function resolveTenantManifestRequest(
  pathname: string,
): TenantPluginManifestResponse | null {
  const match = pathname.match(/^\/api\/tenants\/([^/]+)\/plugin-manifest$/);
  if (!match) {
    return null;
  }

  const tenantId = decodeURIComponent(match[1]);
  return getTenantManifestResponse(tenantId);
}

console.log("[backend] tenant manifest endpoint ready", {
  examplePath: getTenantManifestEndpointPath(DEFAULT_TENANT),
});
