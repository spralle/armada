import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SHELL_DEV_PORT = 5173;
const BACKEND_DEV_PORT = 8787;
const PACKAGES_DIR = fileURLToPath(new URL("../../packages", import.meta.url));
const UI_SRC_ROOT = fileURLToPath(new URL("../../packages/ui/src", import.meta.url));

/**
 * Build aliases that resolve all @ghost-shell/* workspace packages to their
 * TypeScript source during development. This avoids serving pre-built dist
 * files and ensures transitive workspace imports resolve correctly.
 */
function buildWorkspaceAliases(): { find: string | RegExp; replacement: string }[] {
  const aliases: { find: string | RegExp; replacement: string }[] = [];
  const dirs = readdirSync(PACKAGES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const dir of dirs) {
    const pkgPath = resolve(PACKAGES_DIR, dir.name, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    if (!pkg.name?.startsWith("@ghost-shell/")) continue;

    const srcDir = resolve(PACKAGES_DIR, dir.name, "src");
    if (!existsSync(srcDir)) continue;

    // Subpath alias (must come before root alias)
    aliases.push({ find: new RegExp(`^${escapeRegex(pkg.name)}/(.+)$`), replacement: `${srcDir}/$1` });
    // Root alias
    aliases.push({ find: pkg.name, replacement: `${srcDir}/index.ts` });
  }

  return aliases;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const workspaceAliases = buildWorkspaceAliases();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      ...workspaceAliases,
      // Mirror the UI package's tsconfig path mapping so that its internal
      // `@/lib/utils` imports resolve when the shell consumes raw source.
      { find: /^@\/(.+)/, replacement: `${UI_SRC_ROOT}/$1` },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: SHELL_DEV_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${BACKEND_DEV_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
