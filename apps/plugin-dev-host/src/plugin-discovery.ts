/**
 * Filesystem-based plugin discovery for the dev host.
 *
 * Scans plugins / * /package.json for a ghost.pluginId field to build the
 * plugin list dynamically. Directories without a valid package.json or
 * without a ghost.pluginId are skipped with a warning.
 *
 * Port assignment: each plugin's ghost.devPort from package.json is
 * used if present; otherwise a port is assigned dynamically starting from
 * BASE_DEV_PORT based on sorted folder order.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface DiscoveredPluginDefinition {
  id: string;
  folderName: string;
  devPort: number;
}

const BASE_DEV_PORT = 4170;

interface GhostPackageJsonFields {
  ghost?: {
    pluginId?: string;
    devPort?: number;
  };
}

/**
 * Discovers plugins by scanning a directory for subdirectories containing
 * a package.json with a ghost.pluginId field.
 *
 * Results are sorted by folder name for deterministic port assignment and
 * consistent ordering.
 */
export function discoverPlugins(pluginsDir: string): DiscoveredPluginDefinition[] {
  let entries: string[];
  try {
    entries = readdirSync(pluginsDir);
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      console.warn(`[plugin-discovery] plugins directory not found: ${pluginsDir}`);
      return [];
    }
    throw error;
  }

  const folderNames = entries
    .filter((entry) => {
      try {
        return statSync(join(pluginsDir, entry)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.localeCompare(b));

  const discovered: DiscoveredPluginDefinition[] = [];
  let nextAutoPort = BASE_DEV_PORT + 1;

  for (const folderName of folderNames) {
    const packageJsonPath = join(pluginsDir, folderName, "package.json");

    let raw: string;
    try {
      raw = readFileSync(packageJsonPath, "utf-8");
    } catch {
      console.warn(`[plugin-discovery] skipping ${folderName}: no package.json`);
      continue;
    }

    let parsed: GhostPackageJsonFields;
    try {
      parsed = JSON.parse(raw) as GhostPackageJsonFields;
    } catch {
      console.warn(`[plugin-discovery] skipping ${folderName}: invalid package.json`);
      continue;
    }

    const pluginId = parsed.ghost?.pluginId;
    if (!pluginId) {
      console.warn(`[plugin-discovery] skipping ${folderName}: no ghost.pluginId in package.json`);
      continue;
    }

    const devPort = parsed.ghost?.devPort ?? nextAutoPort;
    if (!parsed.ghost?.devPort) {
      nextAutoPort += 1;
    }

    discovered.push({ id: pluginId, folderName, devPort });
  }

  return discovered;
}
