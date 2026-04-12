import { resolve } from "node:path";
import { parsePluginDevHostArgs } from "./cli.js";
import { createPluginGateway } from "./gateway-server.js";

const workspaceRoot = resolve(import.meta.dirname, "../../..");
const pluginsDir = resolve(workspaceRoot, "plugins");

const cliOptions = parsePluginDevHostArgs(process.argv.slice(2), pluginsDir);

const gateway = createPluginGateway({
  pluginIds: cliOptions.pluginIds,
  port: cliOptions.port,
  workspaceRoot,
  pluginsDir,
});

gateway.start().catch((error: unknown) => {
  console.error("[plugin-dev-host] Fatal: failed to start gateway.", error);
  process.exit(1);
});

let shuttingDown = false;

function handleShutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("\n[plugin-dev-host] Shutting down...");
  gateway
    .stop()
    .then(() => {
      console.log("[plugin-dev-host] All Vite instances closed.");
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error("[plugin-dev-host] Error during shutdown:", error);
      process.exit(1);
    });
}

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);
