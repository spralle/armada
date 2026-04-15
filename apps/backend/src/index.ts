import { resolve } from "node:path";
import {
  getTenantManifestEndpointPath,
  getDefaultLocalPluginEntryUrlMap,
  getTenantManifestResponse,
  createDefaultLocalPluginEntryUrlMap,
  resolveTenantManifestRequest,
} from "./tenant-manifest.js";
import {
  formatLocalPluginOverrideStartupSummary,
  parseBackendDevCliOptions,
} from "./dev-cli-options.js";
import { createRouter, jsonResponse, type Route } from "./router.js";
import { createConfigRoutes } from "./config-endpoints.js";
import { createOverrideRoutes } from "./override-endpoints.js";
import { createSessionRoutes } from "./session-endpoints.js";
import { bootstrapBackendConfig, logConfigBootstrapSummary } from "./config-bootstrap.js";
import { createInMemoryAuditLog, createInMemoryOverrideTracker } from "@weaver/config-server";
import { createGodModeSessionProvider } from "@weaver/config-providers";

const BACKEND_DEV_HOST = "127.0.0.1";
const BACKEND_DEV_PORT = 8787;
const DEFAULT_TENANT = "demo";

interface NodeHttpRequestLike { method?: string | undefined; url?: string | undefined; headers?: Record<string, string | string[] | undefined> | undefined }
interface NodeHttpResponseLike { setHeader(name: string, value: string): void; statusCode: number; end(body?: string): void }

const backendDevCliOptions = parseBackendDevCliOptions(getRuntimeArgv());
const localPluginEntryOverrides = backendDevCliOptions.gatewayPort
  ? createDefaultLocalPluginEntryUrlMap({
      appsRoot: "plugins",
      gatewayPort: backendDevCliOptions.gatewayPort,
    })
  : getDefaultLocalPluginEntryUrlMap();

// When --gateway-port is set but no --local-plugin flags provided,
// auto-select all known plugins so every entry routes through the gateway.
const effectiveSelectedPluginIds =
  backendDevCliOptions.gatewayPort && backendDevCliOptions.selectedLocalPluginIds.length === 0
    ? Array.from(localPluginEntryOverrides.keys())
    : backendDevCliOptions.selectedLocalPluginIds;

if (backendDevCliOptions.duplicateSelectedLocalPluginIds.length > 0) {
  console.warn(
    `[backend] duplicate --local-plugin values ignored after normalization: ${backendDevCliOptions.duplicateSelectedLocalPluginIds.join(", ")}`,
  );
}

console.log(
  formatLocalPluginOverrideStartupSummary(
    effectiveSelectedPluginIds,
    localPluginEntryOverrides,
  ),
);

const overrideOptions = {
  selectedLocalPluginIds: backendDevCliOptions.selectedLocalPluginIds,
  pluginEntryUrlOverridesById: localPluginEntryOverrides,
};

const CONFIG_DIR = resolve(process.cwd(), "config");

// Bootstrap backend config (async, but don't block server start)
bootstrapBackendConfig({ configDir: CONFIG_DIR, tenantId: "demo" })
  .then(() => {
    logConfigBootstrapSummary(CONFIG_DIR, undefined, "demo");
  })
  .catch((error: unknown) => {
    console.warn("[backend:config] bootstrap failed, continuing without config", error);
  });

const auditLog = createInMemoryAuditLog();
const overrideTracker = createInMemoryOverrideTracker();

const configRoutes = createConfigRoutes({
  configDir: CONFIG_DIR,
}, {
  auditLog,
  overrideTracker,
});

const overrideRoutes = createOverrideRoutes({
  auditLog,
  overrideTracker,
});

const sessionController = createGodModeSessionProvider();
const sessionRoutes = createSessionRoutes({ sessionController });

const routes: Route[] = [
  {
    method: "GET",
    pattern: /^\/api\/tenants\/([^/]+)\/plugin-manifest$/,
    handler: (params) => {
      const tenantId = decodeURIComponent(params[0]);
      return jsonResponse(getTenantManifestResponse(tenantId, overrideOptions));
    },
  },
  ...configRoutes,
  ...overrideRoutes,
  ...sessionRoutes,
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
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => { headers[key] = value; });
      return router({
        method: request.method,
        pathname: url.pathname,
        body: () => request.json().catch(() => null),
        headers,
        search: url.search,
      });
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
        const parsedUrl = req.url ? new URL(req.url, `http://${BACKEND_DEV_HOST}:${BACKEND_DEV_PORT}`) : undefined;
        const pathname = parsedUrl?.pathname ?? "/";
        const search = parsedUrl?.search ?? "";
        const headers: Record<string, string> = {};
        if (req.headers) {
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === "string") { headers[k] = v; }
          }
        }
        const response = router({ method: req.method ?? "GET", pathname, body: () => Promise.resolve(null), headers, search });

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
