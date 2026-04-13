import type { PluginContract } from "@ghost/plugin-contracts";
import { createShellPluginRegistry } from "../plugin-registry.js";
import { activateByStartupEvent } from "../plugin-registry-activation.js";
import { createThemeRegistry } from "../theme-registry.js";
import type { ThemeRegistry } from "../theme-registry.js";
import { readUserThemePreference } from "../theme-persistence.js";
import {
  activatePreferredThemePlugin,
  DEFAULT_THEME_PLUGIN_ID,
} from "../theme-activation.js";
import { registerThemeServiceCapability } from "../theme-service-registration.js";
import type {
  ShellBootstrapOptions,
  ShellBootstrapState,
} from "./types.js";
import { parseTenantManifestFallback } from "./utils.js";

async function fetchManifestFromEndpoint(manifestUrl: string): Promise<unknown> {
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch tenant manifest from '${manifestUrl}' (${response.status})`);
  }

  return response.json();
}

function isLoopbackEntry(entry: string): boolean {
  if (entry.startsWith("local://")) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(entry);
  } catch {
    return false;
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    return false;
  }

  return (
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "localhost" ||
    parsed.hostname === "::1"
  );
}

function resolveBootstrapMode(entries: readonly string[]): "inner-loop" | "integration" {
  return entries.some((entry) => !isLoopbackEntry(entry))
    ? "integration"
    : "inner-loop";
}

export async function bootstrapShellWithTenantManifest(
  options: ShellBootstrapOptions,
): Promise<ShellBootstrapState> {
  const tenantId = options.tenantId.trim();
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const manifestUrl = `/api/tenants/${encodeURIComponent(tenantId)}/plugin-manifest`;
  const fetchManifest = options.fetchManifest ?? fetchManifestFromEndpoint;
  const rawManifest = await fetchManifest(manifestUrl);
  const parsedManifest = parseTenantManifestFallback(rawManifest);

  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors(parsedManifest.tenantId, parsedManifest.plugins);

  if (options.enableByDefault) {
    for (const descriptor of parsedManifest.plugins) {
      await registry.setEnabled(descriptor.id, true);
    }
  }

  // Activate the preferred theme plugin first — theme plugins contribute
  // palette data and have no service dependencies of their own.
  const themePref = readUserThemePreference();
  const preferredPluginId = themePref?.pluginId || undefined;
  await activatePreferredThemePlugin(registry, preferredPluginId, DEFAULT_THEME_PLUGIN_ID);

  // Initialize theme registry and register the ThemeService builtin so that
  // plugins depending on ghost.theme.Service pass dependency validation.
  const themeRegistry = createThemeRegistry({
    pluginRegistry: registry,
    tenantDefaultThemeId: options.defaultThemeId,
  });
  themeRegistry.discoverThemes();
  themeRegistry.applyInitialTheme();
  registerThemeServiceCapability(registry, themeRegistry);

  // Now activate onStartup plugins — ghost.theme.Service is available.
  await activateByStartupEvent(registry);

  const snapshot = registry.getSnapshot();

  return {
    mode: resolveBootstrapMode(parsedManifest.plugins.map((plugin) => plugin.entry)),
    loadedPlugins: snapshot.plugins
      .map((plugin) => plugin.contract)
      .filter((plugin): plugin is PluginContract => plugin !== null),
    registry,
    themeRegistry,
  };
}

const emptyRegistry = createShellPluginRegistry();
emptyRegistry.registerManifestDescriptors("local", []);

export const shellBootstrapState: ShellBootstrapState = {
  mode: "inner-loop",
  loadedPlugins: [],
  registry: emptyRegistry,
};
