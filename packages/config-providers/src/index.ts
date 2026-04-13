// @ghost/config-providers — Storage provider implementations (iteration 2)

export {
  InMemoryStorageProvider,
  type InMemoryProviderOptions,
} from "./in-memory-provider.js";

export {
  StaticJsonStorageProvider,
  type StaticJsonProviderOptions,
} from "./static-json-provider.js";

export {
  LocalStorageProvider,
  type LocalStorageProviderOptions,
} from "./local-storage-provider.js";

export {
  type PluginConfigInput,
  type IncrementalPluginSchemaRegistry,
  collectPluginSchemaDeclarations,
  buildSchemaMap,
  createIncrementalPluginSchemaRegistry,
} from "./plugin-schema-bridge.js";

export {
  createPluginConfigurationLifecycleHooks,
  createInMemoryPluginSchemaRegistry,
  type PluginConfigLifecycleEvent,
  type PluginConfigLifecycleResult,
  type PluginConfigLifecycleStateContainer,
  type PluginConfigurationLifecycleHooks,
  type PluginConfigurationLifecycleOptions,
  type PluginPromoteOptions,
  type PluginSchemaRegistry,
  type SchemaRegistryMutationResult,
} from "./plugin-config-lifecycle-hooks.js";

export {
  createStateContainer,
  type ConfigurationStateContainer,
} from "./state-container.js";

export {
  createConfigurationService,
  type ConfigurationServiceOptions,
} from "./configuration-service.js";

export { createScopedConfigurationService } from "./scoped-service.js";

export { createViewConfigurationService } from "./view-service.js";
