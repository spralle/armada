#!/usr/bin/env node

// Build all plugins in plugins/*/
// Usage: node scripts/build-plugins.mjs [--force] [--only plugin1,plugin2]

import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const pluginsDir = resolve(import.meta.dirname, "..", "plugins");
const require = createRequire(import.meta.url);

/** Resolve the vite CLI entry point so we can spawn Node directly. */
function resolveViteBin() {
  // Try standard resolution from the scripts directory.
  try {
    const vitePkg = require.resolve("vite/package.json");
    return join(vitePkg, "..", "bin", "vite.js");
  } catch {
    // Vite not hoisted to root — try workspace node_modules as fallback.
  }

  // Bun hoists differently than npm: scan workspace packages for a local vite.
  const fallbackDirs = [pluginsDir, resolve(import.meta.dirname, "..", "apps")];
  for (const baseDir of fallbackDirs) {
    try {
      for (const name of readdirSync(baseDir)) {
        const viteBinPath = join(baseDir, name, "node_modules", "vite", "bin", "vite.js");
        if (existsSync(viteBinPath)) {
          return viteBinPath;
        }
      }
    } catch {}
  }

  throw new Error("Cannot resolve vite CLI. Ensure vite is installed in at least one workspace package.");
}

const viteBin = resolveViteBin();

/**
 * Minimal index.html required by @module-federation/vite during build.
 * The MF plugin injects its host-init script into this HTML entry.
 * Plugins that already ship their own index.html are left untouched.
 */
const STUB_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /></head>
  <body><div id="root"></div></body>
</html>
`;

function discoverPlugins() {
  return readdirSync(pluginsDir)
    .filter((name) => {
      const dir = join(pluginsDir, name);
      return (
        statSync(dir).isDirectory() && existsSync(join(dir, "package.json")) && existsSync(join(dir, "vite.config.ts"))
      );
    })
    .sort();
}

function parseArgs(argv) {
  const force = argv.includes("--force");
  const onlyIndex = argv.indexOf("--only");
  const only =
    onlyIndex >= 0 && onlyIndex < argv.length - 1
      ? argv[onlyIndex + 1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
  return { force, only };
}

function getNewestMtime(dir) {
  let newest = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = getNewestMtime(fullPath);
        if (sub > newest) newest = sub;
      } else {
        const mtime = statSync(fullPath).mtimeMs;
        if (mtime > newest) newest = mtime;
      }
    }
  } catch {
    // Directory doesn't exist or is unreadable — treat as stale
    return 0;
  }
  return newest;
}

function isFresh(pluginDir) {
  const srcDir = join(pluginDir, "src");
  const distDir = join(pluginDir, "dist");
  const configPath = join(pluginDir, "vite.config.ts");

  if (!existsSync(distDir)) return false;

  const distMtime = getNewestMtime(distDir);
  if (distMtime === 0) return false;

  const srcMtime = getNewestMtime(srcDir);
  const configMtime = existsSync(configPath) ? statSync(configPath).mtimeMs : 0;

  return distMtime > srcMtime && distMtime > configMtime;
}

/**
 * Ensure a plugin has an index.html so @module-federation/vite can build.
 * Returns true if a stub was created (and should be cleaned up after build).
 */
function ensureIndexHtml(pluginDir) {
  const htmlPath = join(pluginDir, "index.html");
  if (existsSync(htmlPath)) return false;
  writeFileSync(htmlPath, STUB_INDEX_HTML, "utf8");
  return true;
}

function removeStubIndexHtml(pluginDir) {
  const htmlPath = join(pluginDir, "index.html");
  try {
    unlinkSync(htmlPath);
  } catch {
    // Best-effort cleanup
  }
}

function buildPlugin(name) {
  const dir = join(pluginsDir, name);
  const createdStub = ensureIndexHtml(dir);

  return new Promise((resolve, reject) => {
    // Spawn Node with the resolved vite CLI entry point.
    // --target esnext: @module-federation/vite emits top-level await in
    // its host-init chunk; esnext is required for esbuild to accept it.
    const proc = spawn(process.execPath, [viteBin, "build", "--target", "esnext"], {
      cwd: dir,
      stdio: "pipe",
    });

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      if (createdStub) removeStubIndexHtml(dir);
      reject(new Error(`Failed to spawn build for ${name}: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (createdStub) removeStubIndexHtml(dir);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `Exit code ${code}`));
      }
    });
  });
}

async function runWithConcurrency(tasks, concurrency) {
  const queue = [...tasks];
  const running = new Set();

  while (queue.length > 0 || running.size > 0) {
    while (queue.length > 0 && running.size < concurrency) {
      const task = queue.shift();
      const promise = task().finally(() => running.delete(promise));
      running.add(promise);
    }
    if (running.size > 0) {
      await Promise.race(running);
    }
  }
}

async function main() {
  const { force, only } = parseArgs(process.argv.slice(2));
  const allPlugins = discoverPlugins();

  if (only) {
    const unknown = only.filter((name) => !allPlugins.includes(name));
    if (unknown.length > 0) {
      console.error(`Unknown plugin(s): ${unknown.join(", ")}`);
      console.error(`Available: ${allPlugins.join(", ")}`);
      process.exit(1);
    }
  }

  const targets = only ? allPlugins.filter((p) => only.includes(p)) : allPlugins;

  if (targets.length === 0) {
    console.log("No plugins to build.");
    return;
  }

  console.log(`Building ${targets.length} plugin(s)...`);

  let completed = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];
  const CONCURRENCY = 4;

  const tasks = targets.map((name) => () => {
    const dir = join(pluginsDir, name);

    if (!force && isFresh(dir)) {
      skipped++;
      console.log(`  - ${name} (up-to-date, skipped)`);
      return Promise.resolve();
    }

    return buildPlugin(name)
      .then(() => {
        completed++;
        console.log(`  \u2713 ${name} (${completed + skipped}/${targets.length})`);
      })
      .catch((err) => {
        failed++;
        failures.push({ name, error: err.message });
        console.error(`  \u2717 ${name}: ${err.message}`);
      });
  });

  await runWithConcurrency(tasks, CONCURRENCY);

  console.log(`\nDone: ${completed} built, ${skipped} skipped, ${failed} failed`);

  if (failed > 0) {
    console.error("\nFailed plugins:");
    for (const { name, error } of failures) {
      console.error(`  ${name}: ${error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
