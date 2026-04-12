import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createPluginViteInstance,
  closeAllViteInstances,
  type ManagedViteInstance,
} from "./vite-instance-factory.js";
import {
  lookupDefinition,
  resolvePluginConfigPath,
} from "./cli.js";

export interface PluginGatewayOptions {
  pluginIds: readonly string[];
  port: number;
  workspaceRoot: string;
}

export interface PluginGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Creates a plugin dev gateway that multiplexes multiple Vite dev servers
 * behind a single HTTP server.
 *
 * Request routing:
 *   GET /{pluginId}/path → strips prefix → dispatches to Vite middlewares
 *   WebSocket /__vite_hmr/{pluginId} → handled by Vite HMR per-plugin
 */
export function createPluginGateway(
  options: PluginGatewayOptions,
): PluginGateway {
  const { pluginIds, port, workspaceRoot } = options;
  let httpServer: HttpServer | undefined;
  let viteInstances: ManagedViteInstance[] = [];

  return { start, stop };

  async function start(): Promise<void> {
    if (httpServer) {
      throw new Error("Gateway already started. Call stop() first.");
    }

    httpServer = createHttpServer(handleRequest);

    const instancePromises = pluginIds.map((pluginId) => {
      const definition = lookupDefinition(pluginId);
      const configPath = resolvePluginConfigPath(definition, workspaceRoot);

      return createPluginViteInstance({
        pluginId,
        configPath,
        gatewayPort: port,
        httpServer: httpServer as HttpServer,
      });
    });

    viteInstances = await Promise.all(instancePromises);

    const viteMap = buildViteMap(viteInstances);

    httpServer.removeAllListeners("request");
    httpServer.on("request", (req: IncomingMessage, res: ServerResponse) => {
      handleRoutedRequest(req, res, viteMap);
    });

    await listen(httpServer, port);
    printStartupBanner(pluginIds, port);
  }

  async function stop(): Promise<void> {
    await closeAllViteInstances(viteInstances);

    if (httpServer) {
      httpServer.removeAllListeners("request");
      httpServer.removeAllListeners("upgrade");

      await new Promise<void>((resolve, reject) => {
        httpServer?.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
  }
}

function buildViteMap(
  instances: readonly ManagedViteInstance[],
): Map<string, ManagedViteInstance> {
  const map = new Map<string, ManagedViteInstance>();
  for (const instance of instances) {
    map.set(instance.pluginId, instance);
  }
  return map;
}

function handleRequest(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 503;
  res.setHeader("content-type", "text/plain");
  res.end("Plugin Dev Host is starting...");
}

function handleRoutedRequest(
  req: IncomingMessage,
  res: ServerResponse,
  viteMap: ReadonlyMap<string, ManagedViteInstance>,
): void {
  const url = req.url ?? "/";

  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const routeResult = extractPluginRoute(url);

  if (!routeResult) {
    res.statusCode = 404;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "not_found", message: `No plugin route for ${url}` }));
    return;
  }

  const instance = viteMap.get(routeResult.pluginId);
  if (!instance) {
    res.statusCode = 404;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "unknown_plugin",
        message: `Plugin '${routeResult.pluginId}' is not served by this gateway.`,
        available: Array.from(viteMap.keys()),
      }),
    );
    return;
  }

  req.url = routeResult.strippedPath;
  instance.viteServer.middlewares.handle(
    req,
    res,
    () => {
      res.statusCode = 404;
      res.end(`Not found: ${url}`);
    },
  );
}

interface PluginRoute {
  pluginId: string;
  strippedPath: string;
}

function extractPluginRoute(url: string): PluginRoute | null {
  const match = url.match(/^\/([a-z0-9]+(?:\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)*)(\/.*)?$/);
  if (!match) {
    return null;
  }

  const pluginId = match[1];
  const strippedPath = match[2] || "/";

  return { pluginId, strippedPath };
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, HEAD, OPTIONS");
  res.setHeader("access-control-allow-headers", "*");
}

function listen(server: HttpServer, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      server.removeListener("error", onError);
      reject(err);
    };
    server.on("error", onError);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", onError);
      resolve();
    });
  });
}

function printStartupBanner(
  pluginIds: readonly string[],
  port: number,
): void {
  const maxIdLength = Math.max(...pluginIds.map((id) => id.length));
  const pluginLines = pluginIds
    .map((id) => `  \u2713 ${id.padEnd(maxIdLength)}  \u2192  /${id}/`)
    .join("\n");

  console.log(
    `\nPlugin Dev Host \u2014 http://127.0.0.1:${port}\n\n${pluginLines}\n\n` +
      `Serving ${pluginIds.length} plugin${pluginIds.length === 1 ? "" : "s"}. Press Ctrl+C to stop.\n`,
  );
}
