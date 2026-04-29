#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const CONFIG_DIR = path.resolve(repoRoot, "config");
const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){2,4}$/;
const ROOT_FILE_PATTERN = /^[a-z]+(\.[a-z]+)?\.json$/;
const violations = [];

function rel(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

async function validateJsonFile(filePath) {
  const content = await readFile(filePath, "utf-8");
  const relative = rel(filePath);
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    violations.push(`Invalid JSON: ${relative}`);
    return;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    violations.push(`Top-level value must be a plain object: ${relative}`);
    return;
  }
  for (const key of Object.keys(parsed)) {
    if (!KEY_PATTERN.test(key)) {
      violations.push(`Invalid key "${key}" in ${relative} — must match ghost.{plugin}.{category}.{setting}`);
    }
  }
}

async function validateTenantDir(tenantPath, tenantName) {
  const entries = await readdir(tenantPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(tenantPath, entry.name);
    if (entry.isFile()) {
      if (entry.name !== "tenant.json") {
        violations.push(`Unexpected file in tenant "${tenantName}": ${entry.name} — only tenant.json allowed`);
      } else {
        await validateJsonFile(entryPath);
      }
    } else if (entry.isDirectory()) {
      if (entry.name !== "scopes") {
        violations.push(`Unexpected directory in tenant "${tenantName}": ${entry.name} — only scopes/ allowed`);
      } else {
        const scopeEntries = await readdir(entryPath, { withFileTypes: true });
        for (const se of scopeEntries) {
          if (se.isFile() && se.name.endsWith(".json")) {
            await validateJsonFile(path.join(entryPath, se.name));
          }
        }
      }
    }
  }
}

async function main() {
  let configStat;
  try {
    configStat = await stat(CONFIG_DIR);
  } catch {
    violations.push("config/ directory does not exist");
  }
  if (!configStat?.isDirectory()) {
    violations.push("config/ is not a directory");
    return report();
  }

  const entries = await readdir(CONFIG_DIR, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(CONFIG_DIR, entry.name);
    if (entry.isFile() && entry.name.endsWith(".json")) {
      if (!ROOT_FILE_PATTERN.test(entry.name)) {
        violations.push(`Root config file "${entry.name}" does not match naming: {name}.json or {name}.{env}.json`);
      }
      await validateJsonFile(entryPath);
    } else if (entry.isDirectory() && entry.name === "tenants") {
      const tenantEntries = await readdir(entryPath, { withFileTypes: true });
      for (const te of tenantEntries) {
        if (te.isDirectory()) {
          await validateTenantDir(path.join(entryPath, te.name), te.name);
        }
      }
    }
  }
  report();
}

function report() {
  if (violations.length > 0) {
    console.error("[config-schema] Violations found:");
    for (const v of violations) console.error(`- ${v}`);
    process.exitCode = 1;
    return;
  }
  console.log("[config-schema] OK: all config files valid.");
}

main().catch((error) => {
  console.error("[config-schema] Check failed:", error);
  process.exitCode = 1;
});
