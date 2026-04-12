import {
  getTenantManifestEndpointPath,
  getDefaultLocalPluginEntryUrlMap,
  getTenantManifestResponse,
} from "./tenant-manifest.js";
import {
  formatLocalPluginOverrideStartupSummary,
  parseBackendDevCliOptions,
} from "./dev-cli-options.js";
import { createRouter, jsonResponse, type Route } from "./router.js";

const BACKEND_DEV_HOST = "127.0.0.1";
const BACKEND_DEV_PORT = 8787;
const DEFAULT_TENANT = "demo";

interface NodeHttpRequestLike { method?: string | undefined; url?: string | undefined }
interface NodeHttpResponseLike { setHeader(name: string, value: string): void; statusCode: number; end(body?: string): void }

const backendDevCliOptions = parseBackendDevCliOptions(getRuntimeArgv());
const localPluginEntryOverrides = getDefaultLocalPluginEntryUrlMap();

if (backendDevCliOptions.duplicateSelectedLocalPluginIds.length > 0) {
  console.warn(
    `[backend] duplicate --local-plugin values ignored after normalization: ${backendDevCliOptions.duplicateSelectedLocalPluginIds.join(", ")}`,
  );
}

console.log(
  formatLocalPluginOverrideStartupSummary(
    backendDevCliOptions.selectedLocalPluginIds,
    localPluginEntryOverrides,
  ),
);

const overrideOptions = {
  selectedLocalPluginIds: backendDevCliOptions.selectedLocalPluginIds,
  pluginEntryUrlOverridesById: localPluginEntryOverrides,
};

const routes: Route[] = [
  {
    method: "GET",
    pattern: /^\/api\/tenants\/([^/]+)\/plugin-manifest$/,
    handler: (params) => {
      const tenantId = decodeURIComponent(params[0]);
      return jsonResponse(getTenantManifestResponse(tenantId, overrideOptions));
    },
  },
];

const router = createRouter(routes);

function startBackendDevServer(): void {
  const bun = (globalThis as { Bun?: { serve: (options: { hostname: string; port: number; fetch: (request: Request) => Response | Promise<Response>; }) => unknown; }; }).Bun;
  if (!bun) {
    startNodeBackendDevServer();
    return;
  }

  bun.serve({
    hostname: BACKEND_DEV_HOST,
    port: BACKEND_DEV_PORT,
    fetch(request) {
      const url = new URL(request.url);
      return router({ method: request.method, pathname: url.pathname, body: () => Promise.resolve(null) });
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
      const server = createServer((req: NodeHttpRequestLike, res: NodeHttpResponseLike) => {
        const pathname = req.url ? new URL(req.url, `http://${BACKEND_DEV_HOST}:${BACKEND_DEV_PORT}`).pathname : "/";
        const response = router({ method: req.method ?? "GET", pathname, body: () => Promise.resolve(null) });

        void Promise.resolve(response).then((resolved) => {
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.statusCode = resolved.status;
          void resolved.text().then((body) => res.end(body));
        });
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

function getRuntimeArgv(): string[] {
  const runtimeProcess = (globalThis as { process?: { argv?: unknown } }).process;
  if (!runtimeProcess || !Array.isArray(runtimeProcess.argv)) {
    return [];
  }
  return runtimeProcess.argv.slice(2);
}

startBackendDevServer();
console.log("[backend] tenant manifest endpoint ready", {
  examplePath: getTenantManifestEndpointPath(DEFAULT_TENANT),
});
