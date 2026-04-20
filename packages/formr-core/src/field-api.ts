import type { CanonicalPath } from './path.js';
import type { FormState, ValidationIssue, FieldMetaEntry } from './state.js';
import type { FieldApi, FieldConfig, FormDispatchResult } from './contracts.js';
import type { DeepValue } from './type-utils.js';
import { structuredEqual } from './equality.js';

/** Resolve a value from a nested object by walking canonical path segments */
function resolveValue(root: unknown, segments: readonly (string | number)[]): unknown {
  let current: unknown = root;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string | number, unknown>)[seg];
  }
  return current;
}

export interface CreateFieldApiParams<TData, TUi> {
  readonly path: CanonicalPath;
  readonly rawPath: string;
  readonly getState: () => FormState<TData, TUi>;
  readonly setValue: (path: string, value: unknown) => FormDispatchResult;
  readonly getIssues: (path: CanonicalPath) => readonly ValidationIssue[];
  readonly getInitialValue: () => unknown;
  readonly getFieldMeta: (pathKey: string) => FieldMetaEntry | undefined;
  readonly markTouched: (pathKey: string) => void;
  /** Form-level field defaults (tier 2) */
  readonly formDefaults?: FieldConfig | undefined;
  /** Field-level overrides (tier 3, highest priority) */
  readonly config?: FieldConfig | undefined;
}

/**
 * 3-tier merge: schema defaults (tier 1, future) < form-level defaults (tier 2) < field-level overrides (tier 3).
 * Later tiers override earlier ones for defined (non-undefined) properties.
 */
export function mergeFieldConfig(
  formDefaults?: FieldConfig,
  fieldOverrides?: FieldConfig,
): FieldConfig | undefined {
  if (!formDefaults && !fieldOverrides) return undefined;
  if (!formDefaults) return fieldOverrides;
  if (!fieldOverrides) return formDefaults;
  return { ...formDefaults, ...stripUndefined(fieldOverrides) };
}

function stripUndefined(obj: FieldConfig): Partial<FieldConfig> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as Partial<FieldConfig>;
}

/** ADR §9.1 — create a FieldApi that delegates to the parent form */
export function createFieldApi<TData, TUi>(params: CreateFieldApiParams<TData, TUi>): FieldApi<TData, TUi, string> {
  const pathKey = params.path.segments.join('.');

  return {
    path: params.path,

    // Justified: resolveValue walks the actual data structure; cast bridges runtime to static type
    get(): DeepValue<TData, string> {
      const state = params.getState();
      const root = params.path.namespace === 'ui' ? state.uiState : state.data;
      return resolveValue(root, params.path.segments) as DeepValue<TData, string>;
    },

    set(value: DeepValue<TData, string>): FormDispatchResult {
      return params.setValue(params.rawPath, value);
    },

    validate(): readonly ValidationIssue[] {
      const mergedConfig = mergeFieldConfig(params.formDefaults, params.config);
      if (!mergedConfig?.validators?.length) {
        return [];
      }
      const state = params.getState();
      const allIssues: ValidationIssue[] = [];
      for (const validator of mergedConfig.validators) {
        const input = {
          data: state.data,
          uiState: state.uiState,
          ...(state.meta.stage !== undefined ? { stage: state.meta.stage } : {}),
        };
        const result = validator.validate(input);
        if (Array.isArray(result)) {
          allIssues.push(...result);
        }
      }
      return allIssues;
    },

    issues(): readonly ValidationIssue[] {
      return params.getIssues(params.path);
    },

    ui<T = unknown>(selector: (uiState: TUi) => T): T {
      return selector(params.getState().uiState);
    },

    isTouched(): boolean {
      return params.getFieldMeta(pathKey)?.touched ?? false;
    },

    isDirty(): boolean {
      const current = this.get();
      const initial = params.getInitialValue();
      return !structuredEqual(current, initial);
    },

    isValidating(): boolean {
      return params.getFieldMeta(pathKey)?.isValidating ?? false;
    },

    markTouched(): void {
      params.markTouched(pathKey);
    },
  };
}
