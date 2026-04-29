import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const sourceRoots = ["apps", "packages", "plugins"];

// Paths that legitimately define or manipulate raw color values
const colorWhitelistPaths = ["packages/theme/src/", "plugins/theme-default-plugin/src/", "plugins/example-layer-"];

// Demo apps are excluded — they intentionally use hardcoded colors for demonstration
const excludedPaths = ["apps/entity-table-demos/", "apps/formr-demos/"];

// Matches hex color patterns: #fff, #ffff, #ffffff, #ffffffff (3, 4, 6, or 8 hex digits)
const hexColorRegex = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;

// Matches css color functions
const colorFuncRegex = /\b(?:rgba?|hsla?)\s*\(/;

// Matches inline style props in JSX
const inlineStyleRegex = /\bstyle\s*=\s*\{/;

// Suppression comment pattern
const suppressionRegex = /ghost-tokens-ignore/;

async function main() {
  const files = await collectSourceFiles();
  const colorViolations = [];
  const styleViolations = [];

  for (const relativePath of files) {
    const isTsx = relativePath.endsWith(".tsx");
    const isColorWhitelisted = colorWhitelistPaths.some((p) => relativePath.startsWith(p));
    const source = await readFile(path.resolve(repoRoot, relativePath), "utf8");
    const lines = source.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
      // Skip import statements
      if (trimmed.startsWith("import ") || trimmed.startsWith("from ")) continue;
      // Skip lines defining ghost tokens (CSS custom property declarations)
      if (trimmed.includes("--ghost-")) continue;
      // Skip type-only lines
      if (/^[\w<>,\s|&:?[\](){}]+;?\s*$/.test(trimmed) && trimmed.includes(": string")) continue;

      // Check for suppression: current line or previous line contains ghost-tokens-ignore
      if (suppressionRegex.test(trimmed)) continue;
      if (i > 0 && suppressionRegex.test(lines[i - 1])) continue;

      // Check hardcoded colors (skip whitelisted theme/example paths)
      if (!isColorWhitelisted && (hexColorRegex.test(trimmed) || colorFuncRegex.test(trimmed))) {
        colorViolations.push({ file: relativePath, line: i + 1, content: trimmed });
      }

      // Check inline styles that contain hardcoded colors (TSX only)
      if (isTsx && inlineStyleRegex.test(trimmed) && (hexColorRegex.test(trimmed) || colorFuncRegex.test(trimmed))) {
        styleViolations.push({ file: relativePath, line: i + 1, content: trimmed });
      }
    }
  }

  let hasViolations = false;

  if (colorViolations.length) {
    hasViolations = true;
    console.error("[ghost-tokens] Hardcoded color violations:");
    for (const v of colorViolations) {
      console.error(`- ${v.file}:${v.line}: ${v.content}`);
    }
  }

  if (styleViolations.length) {
    hasViolations = true;
    console.error("[ghost-tokens] Inline style violations:");
    for (const v of styleViolations) {
      console.error(`- ${v.file}:${v.line}: ${v.content}`);
    }
  }

  if (!hasViolations) {
    console.log("[ghost-tokens] OK: no violations found.");
    return;
  }

  console.error(`[ghost-tokens] ${colorViolations.length + styleViolations.length} violation(s) found.`);
  process.exitCode = 1;
}

function isTargetFile(relativePath) {
  if (!relativePath.endsWith(".ts") && !relativePath.endsWith(".tsx")) return false;
  if (relativePath.endsWith(".spec.ts") || relativePath.endsWith(".test.ts")) return false;
  if (relativePath.endsWith(".spec.tsx") || relativePath.endsWith(".test.tsx")) return false;
  if (relativePath.includes("/fixtures/")) return false;
  // Skip config files
  const basename = path.basename(relativePath);
  if (basename === "vite.config.ts" || basename === "tsup.config.ts") return false;
  // Skip excluded paths (demo apps)
  if (excludedPaths.some((p) => relativePath.startsWith(p))) return false;
  return true;
}

async function collectSourceFiles() {
  const files = [];
  for (const root of sourceRoots) {
    const rootPath = path.resolve(repoRoot, root);
    const rootEntries = await safeReaddir(rootPath);

    for (const entry of rootEntries) {
      if (!entry.isDirectory()) continue;

      const srcPath = path.join(rootPath, entry.name, "src");
      const srcEntries = await safeReaddir(srcPath);
      if (!srcEntries.length) continue;

      for (const filePath of await walkFiles(srcPath)) {
        const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
        if (isTargetFile(relativePath)) {
          files.push(relativePath);
        }
      }
    }
  }

  return files.sort();
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

main().catch((error) => {
  console.error("[ghost-tokens] Check failed:", error);
  process.exitCode = 1;
});
