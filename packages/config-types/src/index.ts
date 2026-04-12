// @ghost/config-types — Configuration type definitions and Zod schemas

// types.ts — Layer, context, and stack types
export type {
  ConfigurationLayer,
  ScopeDefinition,
  ScopeInstance,
  TenantScopeHierarchy,
  ConfigurationContext,
  ConfigurationLayerEntry,
  ConfigurationLayerStack,
  ConfigurationLayerData,
} from "./types.js";

// property-schema.ts — Property schema and policy types
export type {
  ConfigChangePolicy,
  ConfigurationVisibility,
  ConfigurationRole,
  ConfigReloadBehavior,
  ConfigurationPropertySchema,
} from "./property-schema.js";

// service.ts — Service interfaces
export type {
  ConfigurationInspection,
  ConfigurationService,
  ScopedConfigurationService,
  ViewConfigurationService,
  ServiceConfigurationService,
} from "./service.js";

// providers.ts — Storage provider interfaces
export type {
  WriteResult,
  ConfigurationChange,
  ConfigurationStorageProvider,
  SyncStatus,
  ConfigurationConflict,
  SyncResult,
  SyncableStorageProvider,
} from "./providers.js";

// expressions.ts — Expression evaluator interface
export type {
  ExpressionValidationResult,
  ExpressionEvaluatorProvider,
} from "./expressions.js";

// session.ts — Session layer types
export type {
  SessionMode,
  SessionLayerMetadata,
  SessionLayer,
} from "./session.js";

// access.ts — Permission types and default policies
export type {
  ConfigurationAccessContext,
  LayerWriteConstraint,
  LayerWritePolicy,
  ServiceConfigurationDeclaration,
} from "./access.js";

export { DEFAULT_LAYER_WRITE_POLICIES } from "./access.js";

// schemas-core.ts — Zod schemas for core types
export {
  configurationLayerSchema,
  scopeDefinitionSchema,
  scopeInstanceSchema,
  tenantScopeHierarchySchema,
  configurationContextSchema,
  configurationLayerEntrySchema,
  configurationLayerStackSchema,
  configurationLayerDataSchema,
  configChangePolicySchema,
  configurationVisibilitySchema,
  configurationRoleSchema,
  configReloadBehaviorSchema,
  configurationPropertySchemaSchema,
  expressionValidationResultSchema,
  sessionModeSchema,
  sessionLayerMetadataSchema,
  configurationAccessContextSchema,
  layerWriteConstraintSchema,
  layerWritePolicySchema,
  serviceConfigurationDeclarationSchema,
} from "./schemas-core.js";

// schemas-providers.ts — Zod schemas for provider types
export {
  writeResultSchema,
  configurationChangeSchema,
  configurationConflictSchema,
  syncResultSchema,
  syncStatusSyncedSchema,
  syncStatusSyncingSchema,
  syncStatusOfflineSchema,
  syncStatusConflictSchema,
  syncStatusErrorSchema,
  syncStatusSchema,
  configurationInspectionSchema,
} from "./schemas-providers.js";
