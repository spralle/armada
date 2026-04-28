// Primary pipeline
export { compileTableFields } from './compile-table-fields.js';
export { createTableConfig } from './create-table-config.js';
// Utility
export { humanize } from './humanize.js';
// Types
export type {
  TableFieldDescriptor,
  TableConfig,
  FilterVariant,
  FilterableFieldInfo,
  TableFieldOverride,
  CompileTableFieldsOptions,
  CreateTableConfigOptions,
} from './types.js';
// Re-export schema-core types consumed by downstream packages
export type { SchemaMetadata } from '@ghost-shell/schema-core';
