/**
 * Filesystem-based plugin discovery for the dev host.
 *
 * Scans plugins / * /package.json for a name field to build the
 * plugin list dynamically. Directories without a valid package.json or
 * without a name are skipped with a warning.
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
  /** Absolute path to the plugin's directory. */
  dir: string;
}

const BASE_DEV_PORT = 4170;

interface PluginPackageJson {
  name?: string;
  ghost?: {
    devPort?: number;
  };
}

/**
 * Discovers plugins across multiple directories. Each directory is scanned
 * independently. If two directories contain a plugin with the same ID, the
 * first occurrence wins and a warning is emitted.
 */
export function discoverPlugins(pluginsDirs: string[]): DiscoveredPluginDefinition[] {
  const seen = new Map<string, string>(); // id → source dir
  const merged: DiscoveredPluginDefinition[] = [];

  for (const dir of pluginsDirs) {
    const found = discoverPluginsInDir(dir);
    for (const definition of found) {
      const existingDir = seen.get(definition.id);
      if (existingDir) {
        console.warn(
          `[plugin-discovery] duplicate plugin '${definition.id}' in ${dir} — ` +
            `already discovered in ${existingDir}, skipping duplicate`,
        );
        continue;
      }
      seen.set(definition.id, dir);
      merged.push(definition);
    }
  }

  return merged;
}

/**
 * Discovers plugins by scanning a single directory for subdirectories
 * containing a package.json with a name field.
 *
 * Results are sorted by folder name for deterministic port assignment and
 * consistent ordering.
 */
function discoverPluginsInDir(pluginsDir: string): DiscoveredPluginDefinition[] {
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

    let parsed: PluginPackageJson;
    try {
      const raw_parsed: unknown = JSON.parse(raw);
      if (!raw_parsed || typeof raw_parsed !== "object" || Array.isArray(raw_parsed)) {
        console.warn(`[plugin-discovery] skipping ${folderName}: package.json is not an object`);
        continue;
      }
      parsed = raw_parsed as PluginPackageJson;
    } catch {
      console.warn(`[plugin-discovery] skipping ${folderName}: invalid package.json`);
      continue;
    }

    const pluginId = typeof parsed.name === "string" ? parsed.name.trim() : "";
    if (!pluginId) {
      console.warn(`[plugin-discovery] skipping ${folderName}: no name in package.json`);
      continue;
    }

    const devPort = parsed.ghost?.devPort ?? nextAutoPort;
    if (!parsed.ghost?.devPort) {
      nextAutoPort += 1;
    }

    discovered.push({ id: pluginId, folderName, devPort, dir: join(pluginsDir, folderName) });
  }

  return discovered;
}
