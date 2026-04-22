import type { ValidatorAdapter } from '@ghost/formr-core';
import type { LayoutNode } from './layout/layout-types.js';
import type { SchemaFieldInfo, SchemaMetadata } from './types.js';
import { ingestSchema } from './ingest.js';
import { compileLayout } from './layout/layout-compiler.js';
import { createJsonSchemaValidator, isJsonSchema } from './adapters/json-schema-validator.js';

export interface CreateSchemaFormOptions {
  /** Additional validators to include beyond the auto-detected schema validator */
  readonly validators?: readonly ValidatorAdapter[];
  /** Override the auto-compiled layout with a custom LayoutNode tree */
  readonly layoutOverride?: LayoutNode;
}

export interface SchemaFormResult {
  readonly fields: readonly SchemaFieldInfo[];
  readonly layout: LayoutNode;
  readonly metadata: SchemaMetadata;
  readonly validators: readonly ValidatorAdapter[];
}

/**
 * Pure schema preparation: ingest + compile layout + create validators.
 * Framework-agnostic — use directly or wrap in framework lifecycle (useSchemaForm for React).
 */
export function createSchemaForm(
  schema: unknown,
  options?: CreateSchemaFormOptions,
): SchemaFormResult {
  const result = ingestSchema(schema);
  const layout = options?.layoutOverride ?? compileLayout(result);
  const validators: ValidatorAdapter[] = [];
  if (isJsonSchema(schema)) {
    validators.push(createJsonSchemaValidator(schema));
  }
  if (options?.validators) {
    validators.push(...options.validators);
  }
  return { fields: result.fields, metadata: result.metadata, layout, validators };
}
