#!/usr/bin/env node
// CI validation script — checks changePolicy assignments against security conventions

import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const PLUGIN_DIRS = ["plugins", "apps"];

async function main() {
  const {
    composeConfigurationSchemas,
    deriveContractFromPackageJson,
    validateChangePolicies,
  } = await import("../packages/config-engine/dist/index.js");

  /** @type {import('../packages/config-engine/dist/index.js').ConfigurationSchemaDeclaration[]} */
  const declarations = [];

  for (const dirName of PLUGIN_DIRS) {
    const scanRoot = join(repoRoot, dirName);
    /** @type {import("node:fs").Dirent[]} */
    let entries;
    try {
      entries = await readdir(scanRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(scanRoot, entry.name, "package.json");
      let raw;
      try {
        raw = await readFile(pkgPath, "utf-8");
      } catch {
        continue;
      }
      const pkgJson = JSON.parse(raw);
      const hasConfig =
        pkgJson.ghost?.configuration !== undefined ||
        pkgJson.contributes?.configuration !== undefined;
      if (!hasConfig) continue;

      const contract = deriveContractFromPackageJson(pkgJson);
      const properties =
        pkgJson.ghost?.configuration ?? pkgJson.contributes?.configuration ?? {};
      declarations.push({
        ownerId: contract.pluginId,
        namespace: contract.namespace,
        properties,
      });
    }
  }

  const composed = composeConfigurationSchemas(declarations);
  const violations = validateChangePolicies(composed.schemas);

  if (violations.length === 0) {
    console.log("[change-policy] OK: all changePolicy assignments follow conventions.");
    return;
  }

  const errors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warning");

  if (warnings.length > 0) {
    console.warn("[change-policy] Warnings:");
    for (const w of warnings) {
      console.warn(`  - ${w.violation} (suggest: ${w.suggestedPolicy ?? "review"})`);
    }
  }

  if (errors.length > 0) {
    console.error("[change-policy] Errors:");
    for (const e of errors) {
      console.error(`  - ${e.violation} (suggest: ${e.suggestedPolicy ?? "review"})`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[change-policy] Validation failed:", error);
  process.exitCode = 1;
});
