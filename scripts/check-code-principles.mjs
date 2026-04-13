import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const sourceRoots = ["apps", "packages", "plugins"];
const MAX_FILE_LINES = 350;

const explicitAnyRegex = /\bany\b/;
const defaultExportRegex = /\bexport\s+default\b/;

const allowedDefaultExportPaths = new Set([
  "apps/*/vite.config.ts",
  "apps/*/src/plugin-contract.ts",
  "apps/*/src/plugin-contract-expose.ts",
  "plugins/*/vite.config.ts",
  "plugins/*/src/plugin-contract.ts",
  "plugins/*/src/plugin-contract-expose.ts",
]);

async function main() {
  const productionFiles = await collectProductionTsFiles();

  const explicitAnyViolations = [];
  const defaultExportViolations = [];
  const oversizedFileViolations = [];

  for (const relativePath of productionFiles) {
    const source = await readFile(path.resolve(repoRoot, relativePath), "utf8");

    if (explicitAnyRegex.test(source)) {
      explicitAnyViolations.push(relativePath);
    }

    if (defaultExportRegex.test(source) && !isDefaultExportAllowed(relativePath)) {
      defaultExportViolations.push(relativePath);
    }

    const effectiveLineCount = countEffectiveLines(source);
    if (effectiveLineCount > MAX_FILE_LINES) {
      oversizedFileViolations.push({ file: relativePath, lineCount: effectiveLineCount });
    }
  }

  const hasViolations =
    explicitAnyViolations.length > 0 ||
    defaultExportViolations.length > 0 ||
    oversizedFileViolations.length > 0;

  if (!hasViolations) {
    console.log("[code-principles] OK: no violations found.");
    return;
  }

  if (explicitAnyViolations.length) {
    console.error("[code-principles] Explicit 'any' violations:");
    for (const file of explicitAnyViolations) {
      console.error(`- ${file}`);
    }
  }

  if (defaultExportViolations.length) {
    console.error("[code-principles] Default export violations:");
    for (const file of defaultExportViolations) {
      console.error(`- ${file}`);
    }
  }

  if (oversizedFileViolations.length) {
    console.error(`[code-principles] Oversized file violations (>${MAX_FILE_LINES} lines):`);
    for (const violation of oversizedFileViolations) {
      console.error(`- ${violation.file} (${violation.lineCount} lines)`);
    }
  }

  process.exitCode = 1;
}

async function collectProductionTsFiles() {
  const files = [];
  for (const root of sourceRoots) {
    const rootPath = path.resolve(repoRoot, root);
    const rootEntries = await safeReaddir(rootPath);

    for (const entry of rootEntries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const srcPath = path.join(rootPath, entry.name, "src");
      const srcEntries = await safeReaddir(srcPath);
      if (!srcEntries.length) {
        continue;
      }

      for (const filePath of await walkFiles(srcPath)) {
        const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
        if (isProductionTsFile(relativePath)) {
          files.push(relativePath);
        }
      }
    }
  }

  return files.sort();
}

function isProductionTsFile(relativePath) {
  if (!relativePath.endsWith(".ts")) {
    return false;
  }
  if (relativePath.endsWith(".spec.ts") || relativePath.endsWith(".test.ts")) {
    return false;
  }
  if (relativePath.includes("/fixtures/") || relativePath.includes("/internal-negative/")) {
    return false;
  }
  return true;
}

function isDefaultExportAllowed(relativePath) {
  const parts = relativePath.split("/");
  if (parts.length < 3) {
    return false;
  }

  const wildcardPath = `${parts[0]}/*/${parts.slice(2).join("/")}`;
  return allowedDefaultExportPaths.has(wildcardPath);
}

async function walkFiles(rootPath) {
  const output = [];
  const queue = [rootPath];

  while (queue.length > 0) {
    const current = queue.shift();
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        output.push(fullPath);
      }
    }
  }

  return output;
}

async function safeReaddir(targetPath) {
  try {
    return await readdir(targetPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function countEffectiveLines(source) {
  const lines = source.split(/\r?\n/);
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      continue;
    }
    count += 1;
  }
  return count;
}

main().catch((error) => {
  console.error("[code-principles] Check failed:", error);
  process.exitCode = 1;
});
