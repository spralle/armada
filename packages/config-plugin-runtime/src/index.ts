export { armadaWeaver } from "./armada-layers.js";

export {
  type PluginConfigInput,
  type IncrementalSchemaRegistryAdapter,
  type IncrementalPluginSchemaRegistry,
  collectPluginSchemaDeclarations,
  buildSchemaMap,
  createIncrementalSchemaRegistryAdapter,
  createIncrementalPluginSchemaRegistry,
} from "./plugin-schema-bridge.js";

export {
  createConfigurationLifecycleHooks,
  createPluginConfigurationLifecycleHooks,
  createInMemorySchemaRegistry,
  createInMemoryPluginSchemaRegistry,
  type PluginConfigLifecycleEvent,
  type PluginConfigLifecycleResult,
  type PluginConfigLifecycleStateContainer,
  type ConfigurationLifecycleHooks,
  type ConfigurationLifecycleOptions,
  type PromoteOptions,
  type SchemaRegistry,
  type PluginConfigurationLifecycleHooks,
  type PluginConfigurationLifecycleOptions,
  type PluginPromoteOptions,
  type PluginSchemaRegistry,
  type SchemaRegistryMutationResult,
} from "./plugin-config-lifecycle-hooks.js";
