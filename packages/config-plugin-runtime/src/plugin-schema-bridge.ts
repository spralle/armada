// Plugin schema ingestion bridge — extracts config schemas from plugin contracts

import type { ConfigurationPropertySchema } from "@weaver/config-types";
import type {
  ConfigurationSchemaDeclaration,
  ComposeResult,
  ConfigurationSchemaRegistry,
  RegisterSchemaResult,
  UnregisterSchemaResult,
} from "@weaver/config-engine";
import {
  deriveNamespace,
  composeConfigurationSchemas,
  createSchemaRegistry,
} from "@weaver/config-engine";

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

export interface IncrementalSchemaRegistryAdapter {
  registerPlugin(plugin: PluginConfigInput): RegisterSchemaResult;
  unregisterPlugin(pluginId: string): UnregisterSchemaResult;
  getSchema(fullyQualifiedKey: string): ReturnType<
    ConfigurationSchemaRegistry["getSchema"]
  >;
  getSchemas(): ReturnType<ConfigurationSchemaRegistry["getSchemas"]>;
  getSchemasByOwner(pluginId: string): ReturnType<
    ConfigurationSchemaRegistry["getSchemasByOwner"]
  >;
  getCompositionErrors(): ReturnType<
    ConfigurationSchemaRegistry["getCompositionErrors"]
  >;
}

class DefaultIncrementalSchemaRegistryAdapter
  implements IncrementalSchemaRegistryAdapter
{
  private readonly registry = createSchemaRegistry();

  registerPlugin(plugin: PluginConfigInput): RegisterSchemaResult {
    if (plugin.configuration === undefined) {
      this.registry.unregister(plugin.pluginId);
      return { registeredKeys: [], errors: [] };
    }

    return this.registry.register({
      ownerId: plugin.pluginId,
      namespace: deriveNamespace(plugin.pluginId),
      properties: plugin.configuration.properties,
    });
  }

  unregisterPlugin(pluginId: string): UnregisterSchemaResult {
    return this.registry.unregister(pluginId);
  }

  getSchema(
    fullyQualifiedKey: string,
  ): ReturnType<ConfigurationSchemaRegistry["getSchema"]> {
    return this.registry.getSchema(fullyQualifiedKey);
  }

  getSchemas(): ReturnType<ConfigurationSchemaRegistry["getSchemas"]> {
    return this.registry.getSchemas();
  }

  getSchemasByOwner(
    pluginId: string,
  ): ReturnType<ConfigurationSchemaRegistry["getSchemasByOwner"]> {
    return this.registry.getSchemasByOwner(pluginId);
  }

  getCompositionErrors(): ReturnType<
    ConfigurationSchemaRegistry["getCompositionErrors"]
  > {
    return this.registry.getCompositionErrors();
  }
}

export function createIncrementalSchemaRegistryAdapter(): IncrementalSchemaRegistryAdapter {
  return new DefaultIncrementalSchemaRegistryAdapter();
}

// Backward compatibility aliases
export type IncrementalPluginSchemaRegistry = IncrementalSchemaRegistryAdapter;
export const createIncrementalPluginSchemaRegistry =
  createIncrementalSchemaRegistryAdapter;
