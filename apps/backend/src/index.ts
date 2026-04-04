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
const BACKEND_DEV_HOST = "127.0.0.1";
const BACKEND_DEV_PORT = 8787;

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function startBackendDevServer(): void {
  const bun = (globalThis as { Bun?: { serve: (options: { hostname: string; port: number; fetch: (request: Request) => Response; }) => unknown; }; }).Bun;
  if (!bun) {
    return;
  }

  bun.serve({
    hostname: BACKEND_DEV_HOST,
    port: BACKEND_DEV_PORT,
    fetch(request) {
      const url = new URL(request.url);
      const manifest = resolveTenantManifestRequest(url.pathname);
      if (manifest) {
        return jsonResponse(manifest);
      }

      return jsonResponse(
        {
          error: "not_found",
          message: `No route for ${url.pathname}`,
        },
        404,
      );
    },
  });

  console.log("[backend] dev server listening", {
    host: BACKEND_DEV_HOST,
    port: BACKEND_DEV_PORT,
    examplePath: getTenantManifestEndpointPath(DEFAULT_TENANT),
  });
}

startBackendDevServer();

console.log("[backend] tenant manifest endpoint ready", {
  examplePath: getTenantManifestEndpointPath(DEFAULT_TENANT),
});
