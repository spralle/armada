// Plugin schema ingestion bridge — extracts config schemas from plugin contracts

import type { ConfigurationPropertySchema } from "@ghost/config-types";
import type {
  ConfigurationSchemaDeclaration,
  ComposeResult,
} from "@ghost/config-engine";
import {
  deriveNamespace,
  composeConfigurationSchemas,
} from "@ghost/config-engine";

/**
 * Minimal plugin configuration input to avoid circular dependency
 * on @ghost/plugin-contracts.
 */
export interface PluginConfigInput {
  pluginId: string;
  configuration?: {
    properties: Record<string, ConfigurationPropertySchema>;
  } | undefined;
}

/**
 * Extracts ConfigurationSchemaDeclaration entries from plugin contracts.
 * Plugins without a `configuration` block are skipped.
 */
export function collectPluginSchemaDeclarations(
  plugins: PluginConfigInput[],
): ConfigurationSchemaDeclaration[] {
  const declarations: ConfigurationSchemaDeclaration[] = [];

  for (const plugin of plugins) {
    if (plugin.configuration === undefined) continue;

    declarations.push({
      ownerId: plugin.pluginId,
      namespace: deriveNamespace(plugin.pluginId),
      properties: plugin.configuration.properties,
    });
  }

  return declarations;
}

/**
 * Collects plugin schema declarations and composes them into a unified schema map.
 * Returns the ComposeResult including duplicate-key errors if present.
 */
export function buildSchemaMap(plugins: PluginConfigInput[]): ComposeResult {
  const declarations = collectPluginSchemaDeclarations(plugins);
  return composeConfigurationSchemas(declarations);
}
