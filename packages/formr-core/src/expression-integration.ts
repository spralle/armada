import type { ExpressionEngine, ExpressionScope, RuleDefinition, RuleWriteIntent } from './contracts.js';
import type { FormState } from './state.js';
import { FormrError } from './errors.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function assertSafeSegment(segment: string): void {
  if (DANGEROUS_KEYS.has(segment)) {
    throw new FormrError(
      'FORMR_PROTOTYPE_POLLUTION',
      `Path segment "${segment}" is not allowed — potential prototype pollution`,
    );
  }
}

/** Build evaluation scope from current form state */
export function buildExpressionScope<S extends string>(state: FormState<S>): ExpressionScope {
  return {
    data: state.data,
    uiState: state.uiState,
    meta: state.meta,
  };
}

/** Run expression evaluation on the current state (step 7 of ADR §8).
 *  Returns any writes that should be applied. */
export function evaluateExpressions<S extends string>(
  engine: ExpressionEngine,
  state: FormState<S>,
  rules: readonly RuleDefinition[],
): readonly RuleWriteIntent[] {
  const scope = buildExpressionScope(state);
  const allWrites: RuleWriteIntent[] = [];

  for (const rule of rules) {
    const writes = engine.evaluateRule(rule, scope);
    allWrites.push(...writes);
  }

  return allWrites;
}

/** Set a value at a dot-separated path, returning a new root (immutable) */
function setAtPath(root: Record<string, unknown>, dotPath: string, value: unknown): Record<string, unknown> {
  const segments = dotPath.split('.');
  for (const seg of segments) {
    assertSafeSegment(seg);
  }
  if (segments.length === 0) return root;

  if (segments.length === 1) {
    return { ...root, [segments[0]!]: value };
  }

  const [head, ...rest] = segments;
  const child = (root[head!] ?? {}) as Record<string, unknown>;
  return { ...root, [head!]: setAtPath(child, rest.join('.'), value) };
}

/** Delete a value at a dot-separated path, returning a new root (immutable) */
function deleteAtPath(root: Record<string, unknown>, dotPath: string): Record<string, unknown> {
  const segments = dotPath.split('.');
  for (const seg of segments) {
    assertSafeSegment(seg);
  }
  if (segments.length === 0) return root;

  if (segments.length === 1) {
    const { [segments[0]!]: _, ...rest } = root;
    return rest;
  }

  const [head, ...remaining] = segments;
  const child = root[head!];
  if (child === undefined || child === null || typeof child !== 'object') {
    return root;
  }
  return { ...root, [head!]: deleteAtPath(child as Record<string, unknown>, remaining.join('.')) };
}

/** Apply rule writes to form state (immutable) */
export function applyRuleWrites<S extends string>(
  state: FormState<S>,
  writes: readonly RuleWriteIntent[],
): FormState<S> {
  let data = (state.data ?? {}) as Record<string, unknown>;
  let uiState = (state.uiState ?? {}) as Record<string, unknown>;

  for (const write of writes) {
    if (write.mode === 'delete') {
      if (write.path.startsWith('$ui.')) {
        uiState = deleteAtPath(uiState, write.path.slice(4));
      } else {
        data = deleteAtPath(data, write.path);
      }
    } else {
      if (write.path.startsWith('$ui.')) {
        uiState = setAtPath(uiState, write.path.slice(4), write.value);
      } else {
        data = setAtPath(data, write.path, write.value);
      }
    }
  }

  return { ...state, data, uiState };
}
