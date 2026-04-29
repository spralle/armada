#!/usr/bin/env node
// Schema registry build script — discovers, composes, and generates config schema artifacts

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverViewConfigs } from "./discover-config.mjs";

const PLUGIN_DIRS = ["plugins", "apps"];

/**
 * Scan plugin directories for package.json files declaring configuration schemas.
 * Looks for `ghost.configuration` or `contributes.configuration` fields.
 */
async function findConfigPlugins(repoRoot, scanDirs) {
  /** @type {Array<{ pkgJson: object, dir: string }>} */
  const results = [];
  for (const dirName of scanDirs) {
    const scanRoot = join(repoRoot, dirName);
    /** @type {import("node:fs").Dirent[]} */
    let entries;
    try {
      entries = await readdir(scanRoot, { withFileTypes: true });
    } catch {
      continue; // directory may not exist (e.g. plugins/)
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
      const hasConfig = pkgJson.ghost?.configuration !== undefined || pkgJson.contributes?.configuration !== undefined;
      if (hasConfig) {
        results.push({ pkgJson, dir: join(scanRoot, entry.name) });
      }
    }
  }
  return results;
}

/**
 * Build configuration schema artifacts from plugin declarations.
 * @param {{ repoRoot: string, outputDir: string, scanDirs?: string[] }} options
 */
export async function buildConfigSchemas(options) {
  const { repoRoot, outputDir, scanDirs = PLUGIN_DIRS } = options;

  const { composeConfigurationSchemas, deriveContractFromPackageJson, generateJsonSchema, generateZodSchemaSource } =
    await import("../packages/config-engine/dist/index.js");

  // 1. Find plugin packages with config declarations
  const configPlugins = await findConfigPlugins(repoRoot, scanDirs);

  // 2. Build declarations from discovered plugins
  /** @type {import('../packages/config-engine/dist/index.js').ConfigurationSchemaDeclaration[]} */
  const declarations = [];
  for (const { pkgJson } of configPlugins) {
    const contract = deriveContractFromPackageJson(pkgJson);
    const properties = pkgJson.ghost?.configuration ?? pkgJson.contributes?.configuration ?? {};
    declarations.push({
      ownerId: contract.pluginId,
      namespace: contract.namespace,
      properties,
    });
  }

  // 3. Discover view configs (informational — no compilation)
  const viewConfigDirs = scanDirs.map((d) => join(repoRoot, d));
  const viewConfigs = await discoverViewConfigs(viewConfigDirs);

  // 4. Compose schemas — validates ownership, detects duplicates
  const composed = composeConfigurationSchemas(declarations);
  if (composed.errors.length > 0) {
    return {
      schemaCount: composed.schemas.size,
      viewConfigCount: viewConfigs.length,
      errors: composed.errors,
    };
  }

  // 5. Generate outputs
  const jsonSchema = generateJsonSchema(composed.schemas);
  const zodSource = generateZodSchemaSource(composed.schemas);

  // 6. Write outputs
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "config-schema.json"), `${JSON.stringify(jsonSchema, null, 2)}\n`);
  await writeFile(join(outputDir, "config-schemas.generated.ts"), zodSource);

  return {
    schemaCount: composed.schemas.size,
    viewConfigCount: viewConfigs.length,
    errors: [],
  };
}

// CLI entry point
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const isDirectRun = import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`;

if (isDirectRun) {
  const repoRoot = resolve(__dirname, "..");
  const outputDir = join(repoRoot, "dist");

  buildConfigSchemas({ repoRoot, outputDir })
    .then((result) => {
      if (result.errors.length > 0) {
        console.error("[build-config-schemas] Composition errors:");
        for (const err of result.errors) {
          console.error(`  - [${err.type}] ${err.message}`);
        }
        process.exitCode = 1;
        return;
      }
      console.log(`[build-config-schemas] OK: ${result.schemaCount} schema(s) composed.`);
      if (result.viewConfigCount > 0) {
        console.log(`  View configs discovered: ${result.viewConfigCount}`);
      }
    })
    .catch((error) => {
      console.error("[build-config-schemas] Build failed:", error);
      process.exitCode = 1;
    });
}
