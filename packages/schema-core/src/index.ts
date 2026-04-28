export { ingestSchema } from './ingest.js';
export { isStandardSchema, isZodSchema, isZodV4Schema } from './detect.js';
export { extractFromZod } from './adapters/zod-extractor.js';
export { extractFromZodV4 } from './adapters/zod4-extractor.js';
export { extractFromJsonSchema } from './adapters/json-schema-extractor.js';
export { isJsonSchema } from './adapters/json-schema-detect.js';
export { dereferenceSchema } from './adapters/json-schema-deref.js';
export { SchemaError } from './errors.js';
export type { SchemaErrorCode } from './errors.js';
export {
  mergeMetadata,
  mergeSamePrecedence,
  structuralEqual,
} from './metadata-merge.js';
export type { MergeInput, MetadataSource } from './metadata-merge.js';
export type {
  StandardSchemaV1,
  SchemaFieldInfo,
  SchemaFieldType,
  SchemaIngestionResult,
  SchemaFieldMetadata,
  SchemaMetadata,
  StandardSchemaResult,
  StandardSchemaIssue,
} from './types.js';
export type { JsonSchema } from './adapters/json-schema-types.js';
export {
  registerExtractor,
  findExtractor,
  clearExtractorRegistry,
  createValidationOnlyResult,
} from './extractor-registry.js';
export type { SchemaExtractor } from './extractor-registry.js';
export { isObject, checkType } from './utils.js';
export { applySchemaMiddleware } from './middleware.js';
export type { SchemaMiddleware } from './middleware.js';
