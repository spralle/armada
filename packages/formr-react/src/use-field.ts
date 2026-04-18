import { useMemo, useRef } from 'react';
import type { FormApi, FieldApi, FieldConfig } from '@ghost/formr-core';
import { useFormSelector } from './use-form-selector.js';

/** Get a FieldApi for a specific path, with fine-grained re-rendering */
export function useField<S extends string>(
  form: FormApi<S>,
  path: string,
  config?: FieldConfig,
): FieldApi {
  // Stabilize config reference — inline objects create new references every render
  const configRef = useRef(config);
  const stableConfig = useMemo(() => {
    const prev = configRef.current;
    if (prev === config) return prev;
    if (prev && config && JSON.stringify(prev) === JSON.stringify(config)) return prev;
    configRef.current = config;
    return config;
  }, [config]);

  const field = useMemo(() => form.field(path, stableConfig), [form, path, stableConfig]);

  // Subscribe only to this field's value to trigger re-renders
  useFormSelector(form, () => field.get());

  return field;
}
