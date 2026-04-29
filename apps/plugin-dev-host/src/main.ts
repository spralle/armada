import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { parsePluginDevHostArgs, parsePluginDirFlags } from "./cli.js";
import { createPluginGateway } from "./gateway-server.js";
import { discoverPlugins } from "./plugin-discovery.js";

const workspaceRoot = resolve(import.meta.dirname, "../../..");
const builtinPluginsDir = resolve(workspaceRoot, "plugins");
const extraPluginDirs = parsePluginDirFlags(process.argv.slice(2));
const pluginsDirs = [builtinPluginsDir, ...extraPluginDirs];

const cliOptions = parsePluginDevHostArgs(process.argv.slice(2), pluginsDirs);

if (cliOptions.buildBeforeStart) {
  runPreBuild(cliOptions.livePluginIds);
}

const gateway = createPluginGateway({
  pluginIds: cliOptions.allPluginIds,
  livePluginIds: cliOptions.livePluginIds,
  port: cliOptions.port,
  workspaceRoot,
  pluginsDirs,
});

gateway.start().catch((error: unknown) => {
  console.error("[plugin-dev-host] Fatal: failed to start gateway.", error);
  process.exit(1);
});

/**
 * Build plugins that are NOT in the live list before starting the gateway.
 * Delegates to `scripts/build-plugins.mjs --only <folder1>,<folder2>`.
 * When all plugins are static (--all --build), builds everything.
 */
function runPreBuild(livePluginIds: readonly string[]): void {
  const buildScript = resolve(workspaceRoot, "scripts/build-plugins.mjs");
  const liveSet = new Set(livePluginIds);
  const definitions = discoverPlugins(pluginsDirs);

  const toBuild = definitions.filter((d) => !liveSet.has(d.id)).map((d) => d.folderName);

  if (toBuild.length === 0) {
    console.log("[plugin-dev-host] --build: nothing to build (all plugins are live).");
    return;
  }

  console.log(`[plugin-dev-host] --build: building ${toBuild.length} plugin(s)...`);

  try {
    execFileSync(process.execPath, [buildScript, "--only", toBuild.join(",")], {
      cwd: workspaceRoot,
      stdio: "inherit",
    });
  } catch {
    console.error("[plugin-dev-host] --build: plugin build failed. Aborting.");
    process.exit(1);
  }
}

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
