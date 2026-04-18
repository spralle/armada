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
  readonly config?: FieldConfig | undefined;
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
