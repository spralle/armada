import { useMemo } from 'react';
import {
  ingestSchema,
  compileLayout,
  createJsonSchemaValidator,
  isJsonSchema,
} from '@ghost/formr-from-schema';
import type { LayoutNode, SchemaFieldInfo, SchemaMetadata } from '@ghost/formr-from-schema';
import { useForm } from './use-form.js';
import type { UseFormOptions } from './use-form.js';
import type { FormApi, ValidatorAdapter } from '@ghost/formr-core';

export interface UseSchemaFormOptions extends Omit<UseFormOptions, 'validators'> {
  readonly validators?: readonly ValidatorAdapter[];
  readonly layoutOverride?: LayoutNode;
}

export interface UseSchemaFormResult {
  readonly form: FormApi;
  readonly fields: readonly SchemaFieldInfo[];
  readonly layout: LayoutNode;
  readonly metadata: SchemaMetadata;
}

/**
 * Convenience hook: schema in → form + fields + layout + validation out.
 * Composes ingestSchema, createJsonSchemaValidator, useForm, and compileLayout.
 */
export function useSchemaForm(
  schema: unknown,
  options?: UseSchemaFormOptions,
): UseSchemaFormResult {
  const ingested = useMemo(() => {
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
  }, [schema, options?.layoutOverride]);

  const form = useForm({
    ...options,
    schema,
    validators: ingested.validators,
  });

  return {
    form,
    fields: ingested.fields,
    layout: ingested.layout,
    metadata: ingested.metadata,
  };
}
