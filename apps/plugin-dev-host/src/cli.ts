import {
  CANONICAL_PLUGIN_DEFINITIONS,
  type CanonicalPluginDefinition,
} from "./canonical-plugins.js";

export const DEFAULT_GATEWAY_PORT = 41337;

export interface PluginDevHostCliOptions {
  pluginIds: string[];
  port: number;
}

export function parsePluginDevHostArgs(
  argv: readonly string[],
): PluginDevHostCliOptions {
  const canonicalIds = CANONICAL_PLUGIN_DEFINITIONS.map((d) => d.id);
  const hasOnly = argv.includes("--only");
  const hasAll = argv.includes("--all");

  if (!hasOnly && !hasAll) {
    printUsageAndExit(canonicalIds);
  }

  if (hasOnly && hasAll) {
    exitWithError("Cannot use both --only and --all. Pick one.");
  }

  const port = parsePortFlag(argv);
  const pluginIds = hasAll
    ? canonicalIds.slice()
    : parseOnlyFlag(argv, canonicalIds);

  return { pluginIds, port };
}

export function resolvePluginConfigPath(
  definition: CanonicalPluginDefinition,
  workspaceRoot: string,
): string {
  return `${workspaceRoot}/apps/${definition.folderName}/vite.config.ts`;
}

export function lookupDefinition(
  pluginId: string,
): CanonicalPluginDefinition {
  const found = CANONICAL_PLUGIN_DEFINITIONS.find(
    (d) => d.id === pluginId,
  );
  if (!found) {
    throw new Error(`No canonical definition found for plugin '${pluginId}'.`);
  }
  return found;
}

function parseOnlyFlag(
  argv: readonly string[],
  canonicalIds: readonly string[],
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

  const canonicalIdSet = new Set(canonicalIds);
  const unknownIds = requestedIds.filter((id) => !canonicalIdSet.has(id));

  if (unknownIds.length > 0) {
    exitWithError(
      `Unknown plugin FQDN(s): ${unknownIds.join(", ")}.\n` +
        `Available plugins:\n${canonicalIds.map((id) => `  - ${id}`).join("\n")}`,
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
    "  --all          Serve all canonical plugins",
    "  --port <num>   Gateway port (default: 41337)",
    "",
    "Available plugins:",
    ...availableIds.map((id) => `  - ${id}`),
  ].join("\n");

  console.error(message);
  return process.exit(1);
}

function exitWithError(message: string): never {
  console.error(`[plugin-dev-host] Error: ${message}`);
  return process.exit(1);
}
