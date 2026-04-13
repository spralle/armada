import type { Server as HttpServer } from "node:http";
import { createServer, type ViteDevServer } from "vite";

export interface ViteInstanceOptions {
  pluginId: string;
  configPath: string;
  /** Absolute path to the plugin's own directory — used as Vite `root` to scope file watching. */
  pluginDir: string;
  gatewayPort: number;
  httpServer: HttpServer;
}

export interface ManagedViteInstance {
  pluginId: string;
  viteServer: ViteDevServer;
}

/**
 * Creates a Vite dev server in middleware mode for a single plugin.
 *
 * Overrides:
 * - `base` to `/{pluginId}/` so all assets are served under the gateway prefix
 * - `server.middlewareMode` to `true` — Vite does not open its own port
 * - `server.hmr.server` to share the gateway HTTP server
 * - `server.hmr.path` to a unique WebSocket path per plugin
 */
export async function createPluginViteInstance(
  options: ViteInstanceOptions,
): Promise<ManagedViteInstance> {
  const { pluginId, configPath, pluginDir, gatewayPort, httpServer } = options;

  const viteServer = await createServer({
    configFile: configPath,
    root: pluginDir,
    base: `/${pluginId}/`,
    server: {
      middlewareMode: true,
      hmr: {
        server: httpServer,
        path: `/__vite_hmr/${pluginId}`,
      },
      cors: true,
      watch: {
        ignored: ["**/node_modules/**", "**/dist/**"],
      },
    },
  });

  return { pluginId, viteServer };
}

/**
 * Gracefully closes all managed Vite instances.
 */
export async function closeAllViteInstances(
  instances: readonly ManagedViteInstance[],
): Promise<void> {
  const closeResults = await Promise.allSettled(
    instances.map((instance) => instance.viteServer.close()),
  );

  for (let index = 0; index < closeResults.length; index++) {
    const result = closeResults[index];
    if (result.status === "rejected") {
      console.error(
        `[plugin-dev-host] failed to close Vite instance for ${instances[index].pluginId}:`,
        result.reason,
      );
    }
  }
}
