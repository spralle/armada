import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const guardRoots = [
  "packages/shell/src/index.ts",
  "packages/shell/src/context",
  "packages/shell/src/domain",
  "packages/shell/src/sync",
  "packages/shell/src/ui",
  "packages/shell/src/app",
];

const importRegex = /^\s*import\s+[^;]*from\s+["']([^"']+)["']/gm;
const forbiddenPattern = /(?:^|\/)(?:domain-demo(?:-|\b)|mock-parts(?:\.|\b))/;

async function collectGuardTargets() {
  const files = new Set();
  for (const relativePath of guardRoots) {
    const absolutePath = path.resolve(repoRoot, relativePath);
    const stat = await safeStat(absolutePath);
    if (!stat) {
      continue;
    }

    if (stat.isFile()) {
      if (isScriptFile(relativePath)) {
        files.add(relativePath.replace(/\\/g, "/"));
      }
      continue;
    }

    for (const entry of await walkFiles(absolutePath)) {
      const relative = path.relative(repoRoot, entry).replace(/\\/g, "/");
      if (isScriptFile(relative)) {
        files.add(relative);
      }
    }
  }

  return [...files].sort();
}

// Scopes allowed to use the bare @ghost-shell/contracts barrel import.
const bareContractsAllowedPrefixes = ["apps/shell/", "packages/federation/"];

// Directories to scan for bare @ghost-shell/contracts imports.
const bareContractsScanRoots = ["plugins", "packages", "apps"];

const bareContractsImportPattern = /^@ghost-shell\/contracts$/;

async function collectAllSourceFiles(roots) {
  const files = [];
  for (const root of roots) {
    const absolutePath = path.resolve(repoRoot, root);
    const stat = await safeStat(absolutePath);
    if (!stat?.isDirectory()) continue;
    for (const entry of await walkFiles(absolutePath)) {
      const relative = path.relative(repoRoot, entry).replace(/\\/g, "/");
      if (isScriptFile(relative)) {
        files.push(relative);
      }
    }
  }
  return files.sort();
}

function isAllowedBareContractsImport(filePath) {
  return bareContractsAllowedPrefixes.some((prefix) => filePath.startsWith(prefix));
}

async function checkBareContractsImports() {
  const sourceFiles = await collectAllSourceFiles(bareContractsScanRoots);
  const warnings = [];

  for (const relativePath of sourceFiles) {
    if (isAllowedBareContractsImport(relativePath)) continue;

    const absolutePath = path.resolve(repoRoot, relativePath);
    const source = await readFile(absolutePath, "utf8");

    for (const match of source.matchAll(importRegex)) {
      if (bareContractsImportPattern.test(match[1])) {
        warnings.push({ file: relativePath, specifier: match[1] });
      }
    }
  }

  if (!warnings.length) {
    console.log("[architecture-guardrails] OK: no bare @ghost-shell/contracts imports outside allowed scopes.");
    return;
  }

  console.warn("[architecture-guardrails] WARN: bare @ghost-shell/contracts imports found outside allowed scopes:");
  for (const w of warnings) {
    console.warn(
      `  ${w.file} — use sub-path imports (e.g. @ghost-shell/contracts/plugin, @ghost-shell/contracts/services)`,
    );
  }
}

async function checkForbiddenDomainDemoImports() {
  const guardTargets = await collectGuardTargets();
  const violations = [];

  for (const relativePath of guardTargets) {
    const absolutePath = path.resolve(repoRoot, relativePath);
    const source = await readFile(absolutePath, "utf8");

    for (const match of source.matchAll(importRegex)) {
      const specifier = match[1];
      if (!forbiddenPattern.test(specifier)) {
        continue;
      }

      violations.push({
        file: relativePath,
        specifier,
      });
    }
  }

  if (!violations.length) {
    console.log("[architecture-guardrails] OK: no forbidden core imports found.");
    return;
  }

  console.error("[architecture-guardrails] Found forbidden core -> domain-demo imports:");
  for (const violation of violations) {
    console.error(`- ${violation.file} imports '${violation.specifier}'`);
  }
  console.error("Core modules must remain domain-demo agnostic.");
  process.exitCode = 1;
}

async function main() {
  await checkForbiddenDomainDemoImports();
  await checkBareContractsImports();
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

function isScriptFile(relativePath) {
  return /\.(?:ts|tsx|js|mjs|cjs)$/.test(relativePath);
}

async function safeStat(targetPath) {
  try {
    const fs = await import("node:fs/promises");
    return await fs.stat(targetPath);
  } catch {
    return null;
  }
}

main().catch((error) => {
  console.error("[architecture-guardrails] Check failed:", error);
  process.exitCode = 1;
});
