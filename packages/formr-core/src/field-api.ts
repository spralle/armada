import type { CanonicalPath } from './path.js';
import type { FormState, ValidationIssue } from './state.js';
import type { FieldApi, FieldConfig, FormDispatchResult } from './contracts.js';

/** Resolve a value from a nested object by walking canonical path segments */
function resolveValue(root: unknown, segments: readonly (string | number)[]): unknown {
  let current: unknown = root;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string | number, unknown>)[seg];
  }
  return current;
}

export interface CreateFieldApiParams {
  readonly path: CanonicalPath;
  readonly rawPath: string;
  readonly getState: () => FormState;
  readonly setValue: (path: string, value: unknown) => FormDispatchResult;
  readonly getIssues: (path: CanonicalPath) => readonly ValidationIssue[];
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
export function createFieldApi(params: CreateFieldApiParams): FieldApi {
  return {
    path: params.path,

    get(): unknown {
      const state = params.getState();
      const root = params.path.namespace === 'ui' ? state.uiState : state.data;
      return resolveValue(root, params.path.segments);
    },

    set(value: unknown): FormDispatchResult {
      return params.setValue(params.rawPath, value);
    },

    validate(): readonly ValidationIssue[] {
      // Field-level validators will be wired in SE6; return empty for now
      return [];
    },

    issues(): readonly ValidationIssue[] {
      return params.getIssues(params.path);
    },

    ui<T = unknown>(selector: (uiState: unknown) => T): T {
      return selector(params.getState().uiState);
    },
  };
}
