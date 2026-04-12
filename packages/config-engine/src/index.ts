// @ghost/config-engine — Configuration resolution engine (iteration 1)

// merge.ts — Deep merge utility
export { deepMerge } from "./merge.js";

// namespace.ts — Namespace utilities
export {
  qualifyKey,
  deriveNamespace,
  validateKeyFormat,
  extractNamespace,
} from "./namespace.js";

// scope.ts — Scope chain builder
export type { ScopeChainEntry, BuildScopeChainResult } from "./scope.js";
export { buildScopeChain } from "./scope.js";

// layers.ts — Layer resolution engine
export type { ResolvedConfiguration } from "./layers.js";
export {
  resolveConfiguration,
  inspectKey,
  resolveConfigurationWithCeiling,
} from "./layers.js";

// schema-registry.ts — Schema aggregation
export type {
  ConfigurationSchemaDeclaration,
  ComposedSchemaEntry,
  SchemaCompositionError,
  ComposeResult,
} from "./schema-registry.js";
export { composeConfigurationSchemas } from "./schema-registry.js";

// auth.ts — Authorization checks
export { canRead, canWrite, filterVisibleKeys } from "./auth.js";

// contract-derivation.ts — Package.json contract metadata extraction
export type {
  PackageJsonInput,
  ContractMetadata,
} from "./contract-derivation.js";
export { deriveContractFromPackageJson } from "./contract-derivation.js";
