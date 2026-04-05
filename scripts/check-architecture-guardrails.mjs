import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const guardTargets = [
  "apps/shell/src/context-state.ts",
  "apps/shell/src/intent-runtime.ts",
  "apps/shell/src/persistence.ts",
  "apps/shell/src/window-bridge.ts",
];

const importRegex = /^\s*import\s+[^;]*from\s+["']([^"']+)["']/gm;
const forbiddenPattern = /(?:^|\/)domain-demo(?:-|\b)/;

async function main() {
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

main().catch((error) => {
  console.error("[architecture-guardrails] Check failed:", error);
  process.exitCode = 1;
});
