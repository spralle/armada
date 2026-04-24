import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import {
  createPluginViteInstance,
  closeAllViteInstances,
  type ManagedViteInstance,
} from "./vite-instance-factory.js";
import {
  resolvePluginConfigPath,
  resolvePluginDir,
} from "./cli.js";
import { discoverPlugins, type DiscoveredPluginDefinition } from "./plugin-discovery.js";
import { serveStaticFile } from "./static-serve.js";
import { rewriteManifestPublicPath } from "./manifest-rewrite.js";

export interface PluginGatewayOptions {
  /** All plugin IDs to serve (live + static). */
  pluginIds: readonly string[];
  /** Subset of pluginIds that get live Vite dev servers. */
  livePluginIds: readonly string[];
  port: number;
  workspaceRoot: string;
  pluginsDirs: string[];
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
  const { pluginIds, livePluginIds, port, workspaceRoot, pluginsDirs } = options;
  let httpServer: HttpServer | undefined;
  let viteInstances: ManagedViteInstance[] = [];

  return { start, stop };

  async function start(): Promise<void> {
    if (httpServer) {
      throw new Error("Gateway already started. Call stop() first.");
    }

    httpServer = createHttpServer(handleRequest);

    const allDefinitions = discoverPlugins(pluginsDirs);
    const definitionMap = new Map(allDefinitions.map((d) => [d.id, d]));

    const liveSet = new Set(livePluginIds);
    const staticPluginIds = pluginIds.filter((id) => !liveSet.has(id));

    // Build static-plugin dist directory map and warn about missing dist/
    const staticDistMap = buildStaticDistMap(
      staticPluginIds,
      definitionMap,
    );

    // Create Vite instances only for live plugins
    if (livePluginIds.length > 0) {
      const instancePromises = livePluginIds.map((pluginId) => {
        const definition = definitionMap.get(pluginId);
        if (!definition) {
          throw new Error(
            `No definition found for plugin '${pluginId}'. Discovered: ${allDefinitions.map((d) => d.id).join(", ")}`,
          );
        }
        const configPath = resolvePluginConfigPath(definition);
        const pluginDir = resolvePluginDir(definition);

        return createPluginViteInstance({
          pluginId,
          configPath,
          pluginDir,
          gatewayPort: port,
          httpServer: httpServer as HttpServer,
        });
      });

      viteInstances = await Promise.all(instancePromises);
    }

    const viteMap = buildViteMap(viteInstances);

    httpServer.removeAllListeners("request");
    httpServer.on("request", (req: IncomingMessage, res: ServerResponse) => {
      handleRoutedRequest(req, res, viteMap, staticDistMap, port);
    });

    await listen(httpServer, port);
    printStartupBanner(pluginIds, livePluginIds, staticPluginIds, port);
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
  staticDistMap: ReadonlyMap<string, string>,
  port: number,
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

  // Live Vite plugin — delegate to Vite middleware
  const instance = viteMap.get(routeResult.pluginId);
  if (instance) {
    // Intercept mf-manifest.json to rewrite asset URLs to absolute paths
    if (routeResult.strippedPath === "/mf-manifest.json") {
      // MF vite plugin serves dev manifest at `${base}mf-manifest.json`, so keep the base prefix
      req.url = `/${routeResult.pluginId}${routeResult.strippedPath}`;
      const originalWrite = res.write.bind(res);
      const originalEnd = res.end.bind(res);
      const chunks: Buffer[] = [];

      res.write = (chunk: unknown): boolean => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        return true;
      };

      res.end = (chunk?: unknown): ServerResponse => {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        }
        const body = Buffer.concat(chunks).toString("utf-8");
        try {
          const parsed: unknown = JSON.parse(body);
          const manifest = (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            ? parsed as Record<string, unknown>
            : {};
          const absoluteBase = `http://127.0.0.1:${port}/${routeResult.pluginId}/`;
          const rewritten = rewriteManifestPublicPath(manifest, absoluteBase);
          const rewrittenBody = JSON.stringify(rewritten);
          res.setHeader("content-length", Buffer.byteLength(rewrittenBody));
          originalEnd(rewrittenBody);
        } catch {
          originalEnd(body);
        }
        return res;
      };

      instance.viteServer.middlewares.handle(req, res, () => {
        res.statusCode = 404;
        originalEnd(`Not found: ${url}`);
      });
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
    return;
  }

  // Static pre-built plugin — serve from dist/
  const distDir = staticDistMap.get(routeResult.pluginId);
  if (distDir) {
    const requestedPath = routeResult.strippedPath === "/" ? "/index.html" : routeResult.strippedPath;
    // Strip query string for file resolution
    const pathWithoutQuery = requestedPath.split("?")[0];
    const filePath = resolve(distDir, `.${pathWithoutQuery}`);
    // Guard against path traversal
    const normalizedFilePath = normalize(filePath);
    if (!normalizedFilePath.startsWith(normalize(distDir))) {
      res.statusCode = 403;
      res.setHeader("content-type", "text/plain");
      res.end("Forbidden");
      return;
    }

    // Intercept mf-manifest.json to rewrite asset URLs to absolute paths
    if (pathWithoutQuery === "/mf-manifest.json") {
      try {
        const raw = readFileSync(normalizedFilePath, "utf-8");
        const parsed: unknown = JSON.parse(raw);
        const manifest = (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          ? parsed as Record<string, unknown>
          : {};
        const absoluteBase = `http://127.0.0.1:${port}/${routeResult.pluginId}/`;
        const rewritten = rewriteManifestPublicPath(manifest, absoluteBase);
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-cache");
        res.end(JSON.stringify(rewritten));
      } catch {
        res.statusCode = 500;
        res.setHeader("content-type", "text/plain");
        res.end("Failed to rewrite manifest");
      }
      return;
    }

    serveStaticFile(res, normalizedFilePath);
    return;
  }

  res.statusCode = 404;
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      error: "unknown_plugin",
      message: `Plugin '${routeResult.pluginId}' is not served by this gateway.`,
      available: [...Array.from(viteMap.keys()), ...Array.from(staticDistMap.keys())],
    }),
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

function buildStaticDistMap(
  staticPluginIds: readonly string[],
  definitionMap: ReadonlyMap<string, DiscoveredPluginDefinition>,
): Map<string, string> {
  const map = new Map<string, string>();

  for (const pluginId of staticPluginIds) {
    const definition = definitionMap.get(pluginId);
    if (!definition) {
      console.warn(
        `[plugin-dev-host] static plugin '${pluginId}' has no discovery definition — skipping`,
      );
      continue;
    }

    const distDir = join(definition.dir, "dist");
    if (!existsSync(distDir)) {
      console.warn(
        `[plugin-dev-host] ⚠ plugin '${pluginId}' has no dist/ directory. ` +
          `Run 'bun run build:plugins' to pre-build plugins.`,
      );
      continue;
    }

    map.set(pluginId, distDir);
  }

  return map;
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
  allPluginIds: readonly string[],
  livePluginIds: readonly string[],
  staticPluginIds: readonly string[],
  port: number,
): void {
  const s = allPluginIds.length === 1 ? "" : "s";
  const lines = [`\n[plugin-dev-host] Serving ${allPluginIds.length} plugin${s} on http://127.0.0.1:${port}`];
  if (livePluginIds.length > 0) lines.push(`  Live (HMR):  ${livePluginIds.join(", ")}`);
  if (staticPluginIds.length > 0) lines.push(`  Static:      ${staticPluginIds.join(", ")}`);
  lines.push("", "Press Ctrl+C to stop.\n");
  console.log(lines.join("\n"));
}
