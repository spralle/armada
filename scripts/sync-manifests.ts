/**
 * Syncs plugin manifest.ts exports into each plugin's package.json `ghost` key.
 *
 * Usage:
 *   bun run scripts/sync-manifests.ts          # write changes
 *   bun run scripts/sync-manifests.ts --check   # diff-only, exit 1 on drift
 */

import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = resolve(__dirname, "..", "plugins");
const CHECK_MODE = process.argv.includes("--check");

interface SyncResult {
  plugin: string;
  status: "skipped" | "unchanged" | "updated" | "drift";
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

async function resolveManifestExport(manifestPath: string): Promise<Record<string, unknown> | null> {
  const mod = await import(manifestPath);
  const manifest = mod.pluginManifest ?? mod.manifest ?? mod.default;
  if (manifest && typeof manifest === "object" && !Array.isArray(manifest)) {
    return manifest as Record<string, unknown>;
  }
  return null;
}

async function syncPlugin(pluginDir: string): Promise<SyncResult> {
  const pluginName = pluginDir.split(/[\\/]/).pop()!;
  const manifestPath = join(pluginDir, "src", "manifest.ts");
  const pkgPath = join(pluginDir, "package.json");

  const manifestExists = await access(manifestPath).then(
    () => true,
    () => false,
  );
  if (!manifestExists) {
    return { plugin: pluginName, status: "skipped" };
  }

  const manifest = await resolveManifestExport(manifestPath);
  if (!manifest) {
    console.warn(`⚠ ${pluginName}: manifest.ts found but no valid export`);
    return { plugin: pluginName, status: "skipped" };
  }

  const pkgRaw = await readFile(pkgPath, "utf-8");
  const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;

  const sortedManifest = sortKeysDeep(manifest);
  const currentGhost = pkg.ghost ? sortKeysDeep(pkg.ghost) : undefined;

  const newJson = JSON.stringify(sortedManifest);
  const oldJson = currentGhost ? JSON.stringify(currentGhost) : undefined;

  if (newJson === oldJson) {
    return { plugin: pluginName, status: "unchanged" };
  }

  if (CHECK_MODE) {
    console.error(`✗ ${pluginName}: ghost key is out of sync with manifest.ts`);
    return { plugin: pluginName, status: "drift" };
  }

  pkg.ghost = sortedManifest;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
  console.log(`✓ ${pluginName}: updated ghost key`);
  return { plugin: pluginName, status: "updated" };
}

async function main(): Promise<void> {
  const entries = await readdir(PLUGINS_DIR, { withFileTypes: true });
  const pluginDirs = entries.filter((e) => e.isDirectory()).map((e) => join(PLUGINS_DIR, e.name));

  const results: SyncResult[] = [];
  for (const dir of pluginDirs) {
    results.push(await syncPlugin(dir));
  }

  const updated = results.filter((r) => r.status === "updated");
  const drifted = results.filter((r) => r.status === "drift");
  const skipped = results.filter((r) => r.status === "skipped");
  const unchanged = results.filter((r) => r.status === "unchanged");

  console.log(`\nSummary: ${updated.length} updated, ${unchanged.length} unchanged, ${skipped.length} skipped`);

  if (CHECK_MODE && drifted.length > 0) {
    console.error(`\n${drifted.length} plugin(s) have drifted ghost keys. Run 'bun run sync-manifests' to fix.`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("sync-manifests failed:", err);
  process.exit(1);
});
