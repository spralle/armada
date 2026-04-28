import type { ValidatorFn } from '@ghost-shell/formr-core';
import { isStandardSchemaLike, createStandardSchemaValidator } from '@ghost-shell/formr-core';
import { ingestSchema, isJsonSchema } from '@ghost-shell/schema-core';
import type { SchemaFieldInfo, SchemaMetadata, JsonSchema } from '@ghost-shell/schema-core';
import type { LayoutNode } from './layout/layout-types.js';
import { compileLayout } from './layout/layout-compiler.js';
import { createJsonSchemaValidator } from './adapters/json-schema-validator.js';

export interface CreateSchemaFormOptions {
  /** Additional validators to include beyond the auto-detected schema validator */
  readonly validators?: readonly ValidatorFn[] | undefined;
  /** Override the auto-compiled layout with a custom LayoutNode tree */
  readonly layoutOverride?: LayoutNode | undefined;
}

export interface SchemaFormResult {
  readonly fields: readonly SchemaFieldInfo[];
  readonly layout: LayoutNode;
  readonly metadata: SchemaMetadata;
  readonly validators: readonly ValidatorFn[];
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
  const validators: ValidatorFn[] = [];
  if (isJsonSchema(schema)) {
    validators.push(createJsonSchemaValidator(schema as JsonSchema));
  } else if (isStandardSchemaLike(schema)) {
    validators.push(createStandardSchemaValidator(schema));
  }
  if (options?.validators) {
    validators.push(...options.validators);
  }
  return { fields: result.fields, metadata: result.metadata, layout, validators };
}
