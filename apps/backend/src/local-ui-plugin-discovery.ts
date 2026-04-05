export interface CanonicalLocalUiPluginDefinition {
  id: string;
  folderName: string;
  devPort: number;
  version: string;
  entryPath: string;
}

export interface DiscoveredLocalUiPlugin {
  id: string;
  folderName: string;
  folderPath: string;
  version: string;
  entry: string;
}

export interface DiscoverLocalUiPluginsOptions {
  appsRoot: string;
  host?: string;
  protocol?: "http" | "https";
  definitions?: readonly CanonicalLocalUiPluginDefinition[];
}

/**
 * Canonical local UI plugin conventions for Armada development.
 *
 * - local plugin folders live under `apps/<folderName>`
 * - each plugin serves a module federation manifest at `/mf-manifest.json`
 * - IDs must be globally unique across local plugin folders
 */
export const CANONICAL_LOCAL_UI_PLUGIN_DEFINITIONS: readonly CanonicalLocalUiPluginDefinition[] = [
  {
    id: "com.armada.plugin-starter",
    folderName: "plugin-starter",
    devPort: 4171,
    version: "0.1.0",
    entryPath: "/mf-manifest.json",
  },
  {
    id: "com.armada.sample.contract-consumer",
    folderName: "sample-contract-consumer-plugin",
    devPort: 4172,
    version: "0.1.0",
    entryPath: "/mf-manifest.json",
  },
  {
    id: "com.armada.domain.unplanned-orders",
    folderName: "domain-unplanned-orders-plugin",
    devPort: 4173,
    version: "0.1.0",
    entryPath: "/mf-manifest.json",
  },
  {
    id: "com.armada.domain.vessel-view",
    folderName: "domain-vessel-view-plugin",
    devPort: 4174,
    version: "0.1.0",
    entryPath: "/mf-manifest.json",
  },
] as const;

export function discoverLocalUiPlugins(
  options: DiscoverLocalUiPluginsOptions,
): ReadonlyMap<string, DiscoveredLocalUiPlugin> {
  const host = options.host ?? "127.0.0.1";
  const protocol = options.protocol ?? "http";
  const definitions =
    options.definitions ?? CANONICAL_LOCAL_UI_PLUGIN_DEFINITIONS;

  const orderedDefinitions = [...definitions].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  const discovered = new Map<string, DiscoveredLocalUiPlugin>();

  for (const definition of orderedDefinitions) {
    assertValidPluginId(definition.id, definition.folderName);

    const folderPath = resolveLocalFolderPath(
      options.appsRoot,
      definition.folderName,
    );
    const entry = `${protocol}://${host}:${definition.devPort}${definition.entryPath}`;

    assertValidEntryUrl(entry, definition.id, definition.folderName);

    const existing = discovered.get(definition.id);
    if (existing) {
      throw new Error(
        `Duplicate local plugin id '${definition.id}' detected for folders '${existing.folderName}' and '${definition.folderName}'. Ensure each local plugin uses a unique manifest id.`,
      );
    }

    discovered.set(definition.id, {
      id: definition.id,
      folderName: definition.folderName,
      folderPath,
      version: definition.version,
      entry,
    });
  }

  return discovered;
}

function resolveLocalFolderPath(appsRoot: string, folderName: string): string {
  const withoutTrailingSlash = appsRoot.replace(/[\\/]+$/, "");
  return `${withoutTrailingSlash}/${folderName}`;
}

function assertValidPluginId(id: string, folderName: string): void {
  const normalizedId = id.trim();
  const validPluginIdPattern =
    /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)*$/;

  if (!normalizedId) {
    throw new Error(
      `Invalid local plugin id for folder '${folderName}': plugin id cannot be empty.`,
    );
  }

  if (!validPluginIdPattern.test(normalizedId)) {
    throw new Error(
      `Invalid local plugin id '${id}' for folder '${folderName}'. Expected dot-separated lowercase segments (letters, numbers, hyphens).`,
    );
  }
}

function assertValidEntryUrl(
  entry: string,
  pluginId: string,
  folderName: string,
): void {
  let parsed: URL;
  try {
    parsed = new URL(entry);
  } catch {
    throw new Error(
      `Invalid local plugin entry URL '${entry}' for plugin '${pluginId}' (folder '${folderName}').`,
    );
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(
      `Invalid local plugin entry URL '${entry}' for plugin '${pluginId}' (folder '${folderName}'): protocol must be http or https.`,
    );
  }

  if (parsed.pathname !== "/mf-manifest.json") {
    throw new Error(
      `Invalid local plugin entry URL '${entry}' for plugin '${pluginId}' (folder '${folderName}'): path must be '/mf-manifest.json'.`,
    );
  }
}
