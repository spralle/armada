import { useMemo } from 'react';
import { createSchemaForm } from '@ghost-shell/formr-from-schema';
import type { LayoutNode, SchemaFieldInfo, SchemaMetadata } from '@ghost-shell/formr-from-schema';
import { useForm } from './use-form.js';
import type { UseFormOptions } from './use-form.js';
import type { FormApi, ValidatorFn } from '@ghost-shell/formr-core';

export interface UseSchemaFormOptions<TData, TUi> extends Omit<UseFormOptions<TData, TUi>, 'validators'> {
  readonly validators?: readonly ValidatorFn[];
  readonly layoutOverride?: LayoutNode;
}

export interface UseSchemaFormResult<TData, TUi> {
  readonly form: FormApi<TData, TUi>;
  readonly fields: readonly SchemaFieldInfo[];
  readonly layout: LayoutNode;
  readonly metadata: SchemaMetadata;
}

/**
 * React lifecycle wrapper over createSchemaForm.
 * Memoizes schema preparation; wires validators into useForm.
 */
export function useSchemaForm<TData, TUi>(
  schema: unknown,
  options?: UseSchemaFormOptions<TData, TUi>,
): UseSchemaFormResult<TData, TUi> {
  const prepared = useMemo(
    () => createSchemaForm(schema, {
      layoutOverride: options?.layoutOverride,
      validators: options?.validators,
    }),
    [schema, options?.layoutOverride],
  );

  const form = useForm<TData, TUi>({
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
