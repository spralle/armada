import { useMemo } from 'react';
import { createSchemaForm } from '@ghost-shell/formr-from-schema';
import type { LayoutNode } from '@ghost-shell/formr-from-schema';
import type { SchemaFieldInfo, SchemaMetadata } from '@ghost-shell/schema-core';
import { useForm } from './use-form.js';
import type { UseFormOptions } from './use-form.js';
import type { FormApi, ValidatorFn } from '@ghost-shell/formr-core';
import { resolveFieldStates, pruneHiddenFields } from './resolve-field-state.js';
import type { ResolvedFieldState } from './resolve-field-state.js';

export interface UseSchemaFormOptions<TData, TUi> extends Omit<UseFormOptions<TData, TUi>, 'validators'> {
  readonly validators?: readonly ValidatorFn[];
  readonly layoutOverride?: LayoutNode;
}

export interface UseSchemaFormResult<TData, TUi> {
  readonly form: FormApi<TData, TUi>;
  readonly fields: readonly SchemaFieldInfo[];
  readonly layout: LayoutNode;
  readonly metadata: SchemaMetadata;
  readonly fieldStates: ReadonlyMap<string, ResolvedFieldState>;
}

/**
 * React lifecycle wrapper over createSchemaForm.
 * Memoizes schema preparation; wires validators into useForm.
 * Resolves arbiter $ui field state and prunes hidden fields from layout.
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

  const fieldPaths = useMemo(
    () => prepared.fields.map((f: SchemaFieldInfo) => f.path),
    [prepared.fields],
  );

  const uiState = (form.getState().uiState ?? {}) as Readonly<Record<string, unknown>>;

  const fieldStates = useMemo(
    () => resolveFieldStates(uiState, fieldPaths),
    [uiState, fieldPaths],
  );

  const layout = useMemo(
    () => pruneHiddenFields(prepared.layout, fieldStates) ?? { ...prepared.layout, children: [] },
    [prepared.layout, fieldStates],
  );

  return {
    form,
    fields: prepared.fields,
    layout,
    metadata: prepared.metadata,
    fieldStates,
  };
}
