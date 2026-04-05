import { discoverLocalUiPlugins } from "./local-ui-plugin-discovery.js";

export interface TenantPluginDescriptor {
  id: string;
  version: string;
  entry: string;
  compatibility: {
    shell: string;
    pluginContract: string;
  };
}

export interface TenantPluginManifestResponse {
  tenantId: string;
  plugins: TenantPluginDescriptor[];
}

export interface TenantManifestOverrideOptions {
  selectedLocalPluginIds?: readonly string[];
  pluginEntryUrlOverridesById?: ReadonlyMap<string, string>;
}

const DEFAULT_TENANT = "demo";

const DEFAULT_LOCAL_PLUGIN_ENTRY_URL_MAP = createDefaultLocalPluginEntryUrlMap({
  appsRoot: "apps",
});

const inMemoryTenantPluginDescriptors: Readonly<
  Record<string, TenantPluginDescriptor[]>
> = {
  demo: createCanonicalLocalTenantDescriptors(),
};

export function createCanonicalLocalTenantDescriptors(): TenantPluginDescriptor[] {
  const plugins = discoverLocalUiPlugins({
    appsRoot: "apps",
  });

  return Array.from(plugins.values()).map((plugin) => ({
    id: plugin.id,
    version: plugin.version,
    entry: plugin.entry,
    compatibility: {
      shell: "^1.0.0",
      pluginContract: "^1.0.0",
    },
  }));
}

export function createDefaultLocalPluginEntryUrlMap(options: {
  appsRoot: string;
  host?: string;
  protocol?: "http" | "https";
}): ReadonlyMap<string, string> {
  const discovered = discoverLocalUiPlugins(options);

  return new Map(
    Array.from(discovered, ([pluginId, plugin]) => [pluginId, plugin.entry]),
  );
}

export function applyLocalPluginEntryOverrides(
  plugins: readonly TenantPluginDescriptor[],
  overrideOptions?: TenantManifestOverrideOptions,
): TenantPluginDescriptor[] {
  const selectedPluginIds = normalizeSelectedPluginIds(
    overrideOptions?.selectedLocalPluginIds,
  );

  if (selectedPluginIds.size === 0) {
    return plugins.slice();
  }

  const entryOverridesByPluginId =
    overrideOptions?.pluginEntryUrlOverridesById ??
    DEFAULT_LOCAL_PLUGIN_ENTRY_URL_MAP;

  return plugins.map((plugin) => {
    if (!selectedPluginIds.has(plugin.id)) {
      return {
        ...plugin,
      };
    }

    const overriddenEntry = entryOverridesByPluginId.get(plugin.id);
    if (!overriddenEntry) {
      return {
        ...plugin,
      };
    }

    return {
      ...plugin,
      entry: overriddenEntry,
    };
  });
}

export function getTenantManifestEndpointPath(tenantId: string): string {
  return `/api/tenants/${encodeURIComponent(tenantId)}/plugin-manifest`;
}

export function getTenantManifestResponse(
  tenantId: string,
  overrideOptions?: TenantManifestOverrideOptions,
): TenantPluginManifestResponse {
  const normalizedTenantId = tenantId.trim() || DEFAULT_TENANT;
  const plugins = inMemoryTenantPluginDescriptors[normalizedTenantId] ?? [];

  return {
    tenantId: normalizedTenantId,
    plugins: applyLocalPluginEntryOverrides(plugins, overrideOptions),
  };
}

export function resolveTenantManifestRequest(
  pathname: string,
  overrideOptions?: TenantManifestOverrideOptions,
): TenantPluginManifestResponse | null {
  const match = pathname.match(/^\/api\/tenants\/([^/]+)\/plugin-manifest$/);
  if (!match) {
    return null;
  }

  const tenantId = decodeURIComponent(match[1]);
  return getTenantManifestResponse(tenantId, overrideOptions);
}

function normalizeSelectedPluginIds(
  selectedPluginIds: readonly string[] | undefined,
): ReadonlySet<string> {
  if (!selectedPluginIds || selectedPluginIds.length === 0) {
    return new Set();
  }

  const orderedUniquePluginIds = Array.from(
    new Set(
      selectedPluginIds
        .map((pluginId) => pluginId.trim())
        .filter((pluginId) => pluginId.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return new Set(orderedUniquePluginIds);
}
