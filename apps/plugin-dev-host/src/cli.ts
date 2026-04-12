import {
  discoverPlugins,
  type DiscoveredPluginDefinition,
} from "./plugin-discovery.js";

export const DEFAULT_GATEWAY_PORT = 41337;

export interface PluginDevHostCliOptions {
  /** Every discovered plugin ID to serve (live + static). */
  allPluginIds: string[];
  /** Subset that get live Vite dev servers (from --only). */
  livePluginIds: string[];
  port: number;
}

export function parsePluginDevHostArgs(
  argv: readonly string[],
  pluginsDir: string,
): PluginDevHostCliOptions {
  const definitions = discoverPlugins(pluginsDir);
  const discoveredIds = definitions.map((d) => d.id);
  const hasOnly = argv.includes("--only");
  const hasAll = argv.includes("--all");

  if (!hasOnly && !hasAll) {
    printUsageAndExit(discoveredIds);
  }

  if (hasOnly && hasAll) {
    exitWithError("Cannot use both --only and --all. Pick one.");
  }

  const port = parsePortFlag(argv);

  // --all: serve all plugins as static (no live Vite instances)
  // --only <ids>: specified plugins get live Vite, all discovered are served
  const livePluginIds = hasAll ? [] : parseOnlyFlag(argv, discoveredIds);
  const allPluginIds = discoveredIds.slice();

  return { allPluginIds, livePluginIds, port };
}

export function resolvePluginDir(
  definition: DiscoveredPluginDefinition,
  workspaceRoot: string,
): string {
  return `${workspaceRoot}/plugins/${definition.folderName}`;
}

export function resolvePluginConfigPath(
  definition: DiscoveredPluginDefinition,
  workspaceRoot: string,
): string {
  return `${resolvePluginDir(definition, workspaceRoot)}/vite.config.ts`;
}

function parseOnlyFlag(
  argv: readonly string[],
  discoveredIds: readonly string[],
): string[] {
  const onlyIndex = argv.indexOf("--only");
  const value = argv[onlyIndex + 1];

  if (!value || value.startsWith("--")) {
    exitWithError(
      "Missing value for --only. Use --only <pluginId1>,<pluginId2>",
    );
  }

  const requestedIds = value.split(",").map((s) => s.trim()).filter(Boolean);
  if (requestedIds.length === 0) {
    exitWithError("--only value is empty. Provide comma-separated plugin FQDNs.");
  }

  const idSet = new Set(discoveredIds);
  const unknownIds = requestedIds.filter((id) => !idSet.has(id));

  if (unknownIds.length > 0) {
    exitWithError(
      `Unknown plugin FQDN(s): ${unknownIds.join(", ")}.\n` +
        `Available plugins:\n${discoveredIds.map((id) => `  - ${id}`).join("\n")}`,
    );
  }

  return requestedIds;
}

function parsePortFlag(argv: readonly string[]): number {
  const portIndex = argv.indexOf("--port");
  if (portIndex === -1) {
    return DEFAULT_GATEWAY_PORT;
  }

  const value = argv[portIndex + 1];
  if (!value || value.startsWith("--")) {
    exitWithError("Missing value for --port. Use --port <number>.");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    exitWithError(`Invalid port '${value}'. Expected a positive integer.`);
  }

  return parsed;
}

function printUsageAndExit(availableIds: readonly string[]): never {
  const message = [
    "Plugin Dev Host — serve multiple plugin dev servers behind one port.",
    "",
    "Usage:",
    "  bun apps/plugin-dev-host/src/main.ts --only <id1>,<id2>",
    "  bun apps/plugin-dev-host/src/main.ts --all",
    "  bun apps/plugin-dev-host/src/main.ts --only <id> --port 9999",
    "",
    "Flags:",
    "  --only <ids>   Comma-separated plugin FQDNs to serve",
    "  --all          Serve all discovered plugins",
    "  --port <num>   Gateway port (default: 41337)",
    "",
    "Discovered plugins:",
    ...availableIds.map((id) => `  - ${id}`),
  ].join("\n");

  console.error(message);
  return process.exit(1);
}

function exitWithError(message: string): never {
  console.error(`[plugin-dev-host] Error: ${message}`);
  return process.exit(1);
}
