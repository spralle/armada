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

export {
  createGodModeSessionProvider,
  type AuditEntry,
  type GodModeSessionProviderOptions,
  type GodModeSessionController,
} from "./session-provider.js";
