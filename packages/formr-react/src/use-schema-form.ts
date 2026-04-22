import { useMemo } from 'react';
import { createSchemaForm } from '@ghost/formr-from-schema';
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
 * React lifecycle wrapper over createSchemaForm.
 * Memoizes schema preparation; wires validators into useForm.
 */
export function useSchemaForm(
  schema: unknown,
  options?: UseSchemaFormOptions,
): UseSchemaFormResult {
  const prepared = useMemo(
    () => createSchemaForm(schema, {
      layoutOverride: options?.layoutOverride,
      validators: options?.validators,
    }),
    [schema, options?.layoutOverride],
  );

  const form = useForm({
    ...options,
    schema,
    validators: prepared.validators,
  });

  return {
    form,
    fields: prepared.fields,
    layout: prepared.layout,
    metadata: prepared.metadata,
  };
}
