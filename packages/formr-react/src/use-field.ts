import { useMemo } from 'react';
import type { FormApi, FieldApi, FieldConfig } from '@ghost/formr-core';
import { useFormSelector } from './use-form-selector.js';

/** Get a FieldApi for a specific path, with fine-grained re-rendering */
export function useField<S extends string>(
  form: FormApi<S>,
  path: string,
  config?: FieldConfig,
): FieldApi {
  const field = useMemo(() => form.field(path, config), [form, path, config]);

  // Subscribe only to this field's value to trigger re-renders
  useFormSelector(form, () => field.get());

  return field;
}
