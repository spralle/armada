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

const VALID_LOCAL_PLUGIN_ID_PATTERN =
  /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)*$/;

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
  {
    id: "com.armada.shared.ui-capabilities",
    folderName: "shared-ui-capability-plugin",
    devPort: 4175,
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
    const entry = `${protocol}://${host}:${definition.devPort}${definition.entryPath}`;

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
      `Invalid local plugin id '${id}' ${context}. Expected dot-separated lowercase segments (letters, numbers, hyphens).`,
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

  if (parsed.pathname !== "/mf-manifest.json") {
    throw new Error(
      `Invalid local plugin entry URL '${entry}' ${context}: path must be '/mf-manifest.json'.`,
    );
  }
}
