#!/usr/bin/env node
// Standalone discovery scanner for *.config.ts view configuration files

import { readdir } from "node:fs/promises";
import { join, relative, basename, sep } from "node:path";

/**
 * @typedef {{ filePath: string, relativePath: string, viewId: string }} DiscoveredViewConfig
 */

const EXCLUDED_DIRS = new Set([
  "node_modules",
  "dist",
  "dist-test",
  ".git",
  ".beads",
]);

const EXCLUDED_FILES = new Set([
  "vite.config.ts",
  "vitest.config.ts",
  "tailwind.config.ts",
]);

/**
 * Discover *.config.ts files recursively, excluding tool configs.
 * @param {string[]} rootDirs - directories to scan
 * @param {{ pattern?: string }} [options]
 * @returns {Promise<DiscoveredViewConfig[]>}
 */
export async function discoverViewConfigs(rootDirs, options = {}) {
  const suffix = options.pattern ?? ".config.ts";
  /** @type {DiscoveredViewConfig[]} */
  const results = [];

  for (const rootDir of rootDirs) {
    /** @type {import("node:fs").Dirent[]} */
    let entries;
    try {
      entries = await readdir(rootDir, { withFileTypes: true });
    } catch {
      console.warn(
        `[discover-config] Warning: directory not found, skipping: ${rootDir}`,
      );
      continue;
    }
    await scanDir(rootDir, rootDir, entries, suffix, results);
  }

  return results;
}

/**
 * @param {string} rootDir
 * @param {string} currentDir
 * @param {import("node:fs").Dirent[]} entries
 * @param {string} suffix
 * @param {DiscoveredViewConfig[]} results
 */
async function scanDir(rootDir, currentDir, entries, suffix, results) {
  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const childEntries = await readdir(fullPath, { withFileTypes: true });
      await scanDir(rootDir, fullPath, childEntries, suffix, results);
    } else if (entry.isFile()) {
      if (!entry.name.endsWith(suffix)) continue;
      if (EXCLUDED_FILES.has(entry.name)) continue;

      const viewId = basename(entry.name, suffix);
      const relPath = relative(rootDir, fullPath).split(sep).join("/");

      results.push({
        filePath: fullPath,
        relativePath: relPath,
        viewId,
      });
    }
  }
}
