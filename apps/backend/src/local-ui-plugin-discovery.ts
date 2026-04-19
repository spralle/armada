import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface CanonicalLocalUiPluginDefinition {
  id: string;
  folderName: string;
  devPort: number;
  version: string;
  entryPath: string;
  pluginDependencies?: string[];
}

export interface DiscoveredLocalUiPlugin {
  id: string;
  folderName: string;
  folderPath: string;
  version: string;
  entry: string;
  pluginDependencies?: string[];
}

export interface DiscoverLocalUiPluginsOptions {
  appsRoot: string;
  host?: string;
  protocol?: "http" | "https";
  definitions?: readonly CanonicalLocalUiPluginDefinition[];
  gatewayPort?: number;
}

const VALID_LOCAL_PLUGIN_ID_PATTERN =
  /^(?:@[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?\/)?[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

/**
 * Scans a plugins directory and returns canonical definitions by reading
 * each plugin's `package.json` for `name` (as plugin ID), `ghost.dependsOn`,
 * and `version` fields.
 *
 * Plugins without a valid `package.json` or without a `name` field are
 * skipped with a warning. Results are sorted by folder name.
 */
export function discoverPluginDefinitions(
  pluginsDir: string,
): CanonicalLocalUiPluginDefinition[] {
  const DEFAULT_DEV_PORT_BASE = 4170;

  let entries: string[];
  try {
    entries = readdirSync(pluginsDir);
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      console.warn(`[plugin-discovery] plugins directory not found: ${pluginsDir}`);
      return [];
    }
    throw error;
  }

  const folderNames = entries
    .filter((entry) => {
      try {
        return statSync(join(pluginsDir, entry)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.localeCompare(b));

  const definitions: CanonicalLocalUiPluginDefinition[] = [];
  let nextAutoPort = DEFAULT_DEV_PORT_BASE + 1;

  for (const folderName of folderNames) {
    const packageJsonPath = join(pluginsDir, folderName, "package.json");

    let raw: string;
    try {
      raw = readFileSync(packageJsonPath, "utf-8");
    } catch {
      console.warn(`[plugin-discovery] skipping ${folderName}: no package.json`);
      continue;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.warn(`[plugin-discovery] skipping ${folderName}: invalid package.json`);
      continue;
    }

    const pluginId = typeof parsed.name === "string" ? parsed.name.trim() : "";
    if (!pluginId) {
      console.warn(`[plugin-discovery] skipping ${folderName}: no name in package.json`);
      continue;
    }

    const ghost = parsed.ghost as {
      displayName?: string;
      dependsOn?: { plugins?: { pluginId: string }[] };
      pluginDependencies?: string[]; // TODO: remove after migration
    } | undefined;

    const pluginDependencies = ghost?.dependsOn?.plugins?.map(p => p.pluginId)
      ?? ghost?.pluginDependencies; // TODO: remove fallback after migration

    const devPort = nextAutoPort;
    nextAutoPort += 1;

    const version = typeof parsed.version === "string" ? parsed.version : "0.1.0";

    definitions.push({
      id: pluginId,
      folderName,
      devPort,
      version,
      entryPath: "/mf-manifest.json",
      pluginDependencies,
    });
  }

  return definitions;
}

/**
 * Canonical local UI plugin conventions for Ghost development.
 *
 * - local plugin folders live under `plugins/<folderName>`
 * - each plugin serves a module federation manifest at `/mf-manifest.json`
 * - IDs must be globally unique across local plugin folders
 *
 * When no explicit `definitions` are provided, the plugins directory
 * (`appsRoot`) is scanned automatically using `discoverPluginDefinitions`.
 */
export function discoverLocalUiPlugins(
  options: DiscoverLocalUiPluginsOptions,
): ReadonlyMap<string, DiscoveredLocalUiPlugin> {
  const host = options.host ?? "127.0.0.1";
  const protocol = options.protocol ?? "http";
  const definitions =
    options.definitions ?? discoverPluginDefinitions(options.appsRoot);

  const normalizedDefinitions = definitions.map((definition) => ({
    ...definition,
    normalizedId: normalizeAndAssertValidLocalPluginId(
      definition.id,
      `for folder '${definition.folderName}'`,
    ),
  }));

  const orderedDefinitions = normalizedDefinitions.sort((left, right) =>
    left.normalizedId.localeCompare(right.normalizedId),
  );

  const discovered = new Map<string, DiscoveredLocalUiPlugin>();

  for (const definition of orderedDefinitions) {
    const folderPath = resolveLocalFolderPath(
      options.appsRoot,
      definition.folderName,
    );
    const entry = options.gatewayPort
      ? `${protocol}://${host}:${options.gatewayPort}/${encodeURIComponent(definition.normalizedId)}/mf-manifest.json`
      : `${protocol}://${host}:${definition.devPort}${definition.entryPath}`;

    assertValidLocalPluginEntryUrl(
      entry,
      definition.normalizedId,
      `for plugin '${definition.normalizedId}' (folder '${definition.folderName}')`,
    );

    const existing = discovered.get(definition.normalizedId);
    if (existing) {
      throw new Error(
        `Duplicate local plugin id '${definition.normalizedId}' detected for folders '${existing.folderName}' and '${definition.folderName}'. Ensure each local plugin uses a unique manifest id.`,
      );
    }

    discovered.set(definition.normalizedId, {
      id: definition.normalizedId,
      folderName: definition.folderName,
      folderPath,
      version: definition.version,
      entry,
      pluginDependencies: definition.pluginDependencies,
    });
  }

  return discovered;
}

function resolveLocalFolderPath(appsRoot: string, folderName: string): string {
  const withoutTrailingSlash = appsRoot.replace(/[\\/]+$/, "");
  return `${withoutTrailingSlash}/${folderName}`;
}

export function normalizeAndAssertValidLocalPluginId(
  id: string,
  context: string,
): string {
  const normalizedId = id.trim();

  if (!normalizedId) {
    throw new Error(`Invalid local plugin id ${context}: plugin id cannot be empty.`);
  }

  if (!VALID_LOCAL_PLUGIN_ID_PATTERN.test(normalizedId)) {
    throw new Error(
      `Invalid local plugin id '${id}' ${context}. Expected a valid npm package name (lowercase, optional @scope/).`,
    );
  }

  return normalizedId;
}

export function assertValidLocalPluginEntryUrl(
  entry: string,
  pluginId: string,
  context: string,
): void {
  let parsed: URL;
  try {
    parsed = new URL(entry);
  } catch {
    throw new Error(
      `Invalid local plugin entry URL '${entry}' ${context}.`,
    );
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(
      `Invalid local plugin entry URL '${entry}' ${context}: protocol must be http or https.`,
    );
  }

  if (!parsed.pathname.endsWith("/mf-manifest.json")) {
    throw new Error(
      `Invalid local plugin entry URL '${entry}' ${context}: path must end with '/mf-manifest.json'.`,
    );
  }
}
