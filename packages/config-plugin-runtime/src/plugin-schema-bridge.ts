// Plugin schema ingestion bridge — extracts config schemas from plugin contracts

import type { ConfigurationPropertySchema } from "@ghost-shell/contracts/plugin";

// @weaver/config-engine removed — inline stub types and throwing functions

/** Stub for ConfigurationSchemaDeclaration (@weaver/config-engine removed). */
export interface ConfigurationSchemaDeclaration {
  ownerId: string;
  namespace: string;
  properties: Record<string, ConfigurationPropertySchema>;
}

/** Stub for ComposeResult (@weaver/config-engine removed). */
export interface ComposeResult {
  schemas: Map<string, ConfigurationPropertySchema & { owner: string }>;
  errors: Array<{ key: string; owners: string[]; message: string }>;
}

/** Stub for ConfigurationSchemaRegistry (@weaver/config-engine removed). */
export interface ConfigurationSchemaRegistry {
  register(declaration: ConfigurationSchemaDeclaration): RegisterSchemaResult;
  unregister(ownerId: string): UnregisterSchemaResult;
  getSchema(key: string): (ConfigurationPropertySchema & { owner: string }) | undefined;
  getSchemas(): Map<string, ConfigurationPropertySchema & { owner: string }>;
  getSchemasByOwner(ownerId: string): Map<string, ConfigurationPropertySchema>;
  getCompositionErrors(): ComposeResult["errors"];
}

/** Stub for RegisterSchemaResult (@weaver/config-engine removed). */
export interface RegisterSchemaResult {
  registeredKeys: string[];
  errors: ComposeResult["errors"];
}

/** Stub for UnregisterSchemaResult (@weaver/config-engine removed). */
export interface UnregisterSchemaResult {
  removedKeys: string[];
}

// @weaver/config-engine removed — stub throws
function deriveNamespace(_pluginId: string): string {
  throw new Error("@weaver/config-engine is not available");
}

// @weaver/config-engine removed — stub throws
function composeConfigurationSchemas(_declarations: ConfigurationSchemaDeclaration[]): ComposeResult {
  throw new Error("@weaver/config-engine is not available");
}

// @weaver/config-engine removed — stub throws
function createSchemaRegistry(): ConfigurationSchemaRegistry {
  throw new Error("@weaver/config-engine is not available");
}

/**
 * Minimal plugin configuration input to avoid circular dependency
 * on @ghost-shell/contracts.
 */
export interface PluginConfigInput {
  pluginId: string;
  configuration?:
    | {
        properties: Record<string, ConfigurationPropertySchema>;
      }
    | undefined;
}

/**
 * Extracts ConfigurationSchemaDeclaration entries from plugin contracts.
 * Plugins without a `configuration` block are skipped.
 */
export function collectPluginSchemaDeclarations(plugins: PluginConfigInput[]): ConfigurationSchemaDeclaration[] {
  const declarations: ConfigurationSchemaDeclaration[] = [];

  for (const plugin of plugins) {
    if (plugin.configuration === undefined) continue;

    declarations.push({
      ownerId: plugin.pluginId,
      namespace: deriveNamespace(plugin.pluginId),
      properties: plugin.configuration.properties as Record<string, WeaverPropertySchema>,
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
  getSchema(fullyQualifiedKey: string): ReturnType<ConfigurationSchemaRegistry["getSchema"]>;
  getSchemas(): ReturnType<ConfigurationSchemaRegistry["getSchemas"]>;
  getSchemasByOwner(pluginId: string): ReturnType<ConfigurationSchemaRegistry["getSchemasByOwner"]>;
  getCompositionErrors(): ReturnType<ConfigurationSchemaRegistry["getCompositionErrors"]>;
}

class DefaultIncrementalSchemaRegistryAdapter implements IncrementalSchemaRegistryAdapter {
  private readonly registry = createSchemaRegistry();

  registerPlugin(plugin: PluginConfigInput): RegisterSchemaResult {
    if (plugin.configuration === undefined) {
      this.registry.unregister(plugin.pluginId);
      return { registeredKeys: [], errors: [] };
    }

    return this.registry.register({
      ownerId: plugin.pluginId,
      namespace: deriveNamespace(plugin.pluginId),
      properties: plugin.configuration.properties as Record<string, WeaverPropertySchema>,
    });
  }

  unregisterPlugin(pluginId: string): UnregisterSchemaResult {
    return this.registry.unregister(pluginId);
  }

  getSchema(fullyQualifiedKey: string): ReturnType<ConfigurationSchemaRegistry["getSchema"]> {
    return this.registry.getSchema(fullyQualifiedKey);
  }

  getSchemas(): Map<string, ComposedSchemaEntry> {
    return this.registry.getSchemas();
  }

  getSchemasByOwner(pluginId: string): ReturnType<ConfigurationSchemaRegistry["getSchemasByOwner"]> {
    return this.registry.getSchemasByOwner(pluginId);
  }

  getCompositionErrors(): ReturnType<ConfigurationSchemaRegistry["getCompositionErrors"]> {
    return this.registry.getCompositionErrors();
  }
}

export function createIncrementalSchemaRegistryAdapter(): IncrementalSchemaRegistryAdapter {
  return new DefaultIncrementalSchemaRegistryAdapter();
}

// Re-export weaver types for downstream consumers
export type {
  ComposedSchemaEntry,
  ComposeResult,
  ConfigurationSchemaDeclaration,
  RegisterSchemaResult,
  UnregisterSchemaResult,
};

// Backward compatibility aliases
export type IncrementalPluginSchemaRegistry = IncrementalSchemaRegistryAdapter;
export const createIncrementalPluginSchemaRegistry = createIncrementalSchemaRegistryAdapter;
