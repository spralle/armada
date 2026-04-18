import type { SchemaIngestionResult } from './types.js';
import { isStandardSchema, isZodSchema, isZodV4Schema } from './detect.js';
import { extractFromZod } from './zod-extractor.js';
import { extractFromZodV4 } from './zod4-extractor.js';
import { extractFromJsonSchema } from './json-schema-extractor.js';
import { isJsonSchema } from './json-schema-validator.js';
import { FromSchemaError } from './errors.js';
import type { JsonSchema } from './json-schema-types.js';

export function ingestSchema(schema: unknown): SchemaIngestionResult {
  if (isStandardSchema(schema) && isZodSchema(schema)) {
    return isZodV4Schema(schema) ? extractFromZodV4(schema) : extractFromZod(schema);
  }

  if (isStandardSchema(schema)) {
    throw new FromSchemaError(
      'FORMR_SCHEMA_UNSUPPORTED',
      `Standard Schema vendor "${schema['~standard'].vendor}" ingestion not yet implemented`,
    );
  }

  if (isJsonSchema(schema)) {
    return extractFromJsonSchema(schema as JsonSchema);
  }

  throw new FromSchemaError('FORMR_SCHEMA_UNSUPPORTED', 'Schema does not conform to Standard Schema v1 or JSON Schema');
}
