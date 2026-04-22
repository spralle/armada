import { resolve } from "node:path";
import {
  discoverPlugins,
  type DiscoveredPluginDefinition,
} from "./plugin-discovery.js";

export const DEFAULT_GATEWAY_PORT = 41337;

export interface PluginDevHostCliOptions {
  /** Every discovered plugin ID to serve (live + static). */
  allPluginIds: string[];
  /** Subset that get live Vite dev servers (from --live / --only). */
  livePluginIds: string[];
  /** Build non-live plugins before starting the gateway. */
  buildBeforeStart: boolean;
  port: number;
  /** Extra plugin directories from --plugin-dir flags. */
  extraPluginDirs: string[];
}

export function parsePluginDevHostArgs(
  argv: readonly string[],
  pluginsDirs: string[],
): PluginDevHostCliOptions {
  const definitions = discoverPlugins(pluginsDirs);
  const discoveredIds = definitions.map((d) => d.id);
  const hasLive = argv.includes("--live");
  const hasOnly = argv.includes("--only");
  const hasAll = argv.includes("--all");

  if (!hasLive && !hasOnly && !hasAll) {
    printUsageAndExit(discoveredIds);
  }

  if (hasLive && hasOnly) {
    exitWithError("Cannot use both --live and --only. They are aliases — pick one.");
  }

  if ((hasLive || hasOnly) && hasAll) {
    exitWithError("Cannot use --live/--only together with --all. Pick one.");
  }

  const port = parsePortFlag(argv);
  const buildBeforeStart = argv.includes("--build");
  const extraPluginDirs = parsePluginDirFlags(argv);

  // --all: serve all plugins as static (no live Vite instances)
  // --live / --only <ids>: specified plugins get live Vite, all discovered are served
  const livePluginIds = hasAll
    ? []
    : parseLiveFlag(argv, hasLive ? "--live" : "--only", discoveredIds);
  const allPluginIds = discoveredIds.slice();

  return { allPluginIds, livePluginIds, buildBeforeStart, port, extraPluginDirs };
}

export function resolvePluginDir(
  definition: DiscoveredPluginDefinition,
): string {
  return definition.dir;
}

export function resolvePluginConfigPath(
  definition: DiscoveredPluginDefinition,
): string {
  return `${definition.dir}/vite.config.ts`;
}

function parseLiveFlag(
  argv: readonly string[],
  flagName: "--live" | "--only",
  discoveredIds: readonly string[],
): string[] {
  const flagIndex = argv.indexOf(flagName);
  const value = argv[flagIndex + 1];

  if (!value || value.startsWith("--")) {
    exitWithError(
      `Missing value for ${flagName}. Use ${flagName} <pluginId1>,<pluginId2>`,
    );
  }

  const requestedIds = value.split(",").map((s) => s.trim()).filter(Boolean);
  if (requestedIds.length === 0) {
    exitWithError(`${flagName} value is empty. Provide comma-separated plugin FQDNs.`);
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

/**
 * Collects all `--plugin-dir <path>` values from argv. The flag is repeatable.
 */
export function parsePluginDirFlags(argv: readonly string[]): string[] {
  const dirs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--plugin-dir") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        exitWithError("Missing value for --plugin-dir. Use --plugin-dir <path>.");
      }
      dirs.push(resolve(value));
      i += 1;
    }
  }
  return dirs;
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
    "Plugin Dev Host — hybrid plugin server for development.",
    "",
    "Usage:",
    "  bun apps/plugin-dev-host/src/main.ts --live <id1>,<id2>         # Live HMR for specified, static for rest",
    "  bun apps/plugin-dev-host/src/main.ts --live <id> --build        # Build non-live plugins first, then start",
    "  bun apps/plugin-dev-host/src/main.ts --all                      # All plugins served static (integration mode)",
    "  bun apps/plugin-dev-host/src/main.ts --all --build              # Build all, then serve static",
    "",
    "Flags:",
    "  --live <ids>   Comma-separated plugin IDs for live Vite dev servers (HMR)",
    "  --only <ids>   Alias for --live",
    "  --all          Serve all discovered plugins as pre-built static files",
    "  --build        Build non-live plugins before starting",
    "  --port <num>   Gateway port (default: 41337)",
    "  --plugin-dir <path>  Additional plugin directory (repeatable, additive)",
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
