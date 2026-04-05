import { discoverLocalUiPlugins } from "./local-ui-plugin-discovery.js";

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
  demo: createCanonicalLocalTenantDescriptors(),
};

function createCanonicalLocalTenantDescriptors(): TenantPluginDescriptor[] {
  const plugins = discoverLocalUiPlugins({
    appsRoot: "apps",
  });

  return Array.from(plugins.values()).map((plugin) => ({
    id: plugin.id,
    version: plugin.version,
    entry: plugin.entry,
    compatibility: {
      shell: "^1.0.0",
      pluginContract: "^1.0.0",
    },
  }));
}

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
    startNodeBackendDevServer();
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

function startNodeBackendDevServer(): void {
  const nodeHttpModuleName = "node:http";

  import(nodeHttpModuleName)
    .then(({ createServer }) => {
      const server = createServer((req: any, res: any) => {
        const requestPath = req.url ? new URL(req.url, `http://${BACKEND_DEV_HOST}:${BACKEND_DEV_PORT}`).pathname : "/";
        const manifest = resolveTenantManifestRequest(requestPath);

        res.setHeader("content-type", "application/json; charset=utf-8");

        if (manifest) {
          res.statusCode = 200;
          res.end(JSON.stringify(manifest));
          return;
        }

        res.statusCode = 404;
        res.end(
          JSON.stringify({
            error: "not_found",
            message: `No route for ${requestPath}`,
          }),
        );
      });

      server.listen(BACKEND_DEV_PORT, BACKEND_DEV_HOST, () => {
        console.log("[backend] dev server listening", {
          host: BACKEND_DEV_HOST,
          port: BACKEND_DEV_PORT,
          examplePath: getTenantManifestEndpointPath(DEFAULT_TENANT),
          runtime: "node:http",
        });
      });
    })
    .catch((error: unknown) => {
      console.error("[backend] failed to start node dev server", error);
      const runtimeProcess = (globalThis as { process?: { exitCode?: number } }).process;
      if (runtimeProcess) {
        runtimeProcess.exitCode = 1;
      }
    });
}

startBackendDevServer();

console.log("[backend] tenant manifest endpoint ready", {
  examplePath: getTenantManifestEndpointPath(DEFAULT_TENANT),
});
