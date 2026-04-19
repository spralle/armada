import type { ExpressionEngine, RuleDefinition, RuleWriteIntent } from './contracts.js';
import type { EvaluationScope } from '@ghost/predicate';
import type { FormState } from './state.js';
import { executeRules, setNestedValue, deleteNestedValue } from './rule-engine.js';
import { assertSafeSegment } from '@ghost/predicate';

/** Build evaluation scope from current form state.
 *  Data fields are spread at top level; $ui and $meta are namespace keys. */
export function buildExpressionScope<S extends string>(state: FormState<S>): EvaluationScope {
  const data = (state.data ?? {}) as Record<string, unknown>;
  return {
    ...data,
    $ui: state.uiState,
    $meta: state.meta,
  };
}

/** Run expression evaluation on the current state (step 7 of ADR §8).
 *  Delegates to the rule engine's fixed-point loop and returns all writes. */
export function evaluateExpressions<S extends string>(
  engine: ExpressionEngine,
  state: FormState<S>,
  rules: readonly RuleDefinition[],
): readonly RuleWriteIntent[] {
  const scope = buildExpressionScope(state);
  const result = executeRules(engine, rules, scope);
  return result.writes;
}

/** Apply rule writes to form state (immutable) */
export function applyRuleWrites<S extends string>(
  state: FormState<S>,
  writes: readonly RuleWriteIntent[],
): FormState<S> {
  let data = (state.data ?? {}) as Record<string, unknown>;
  let uiState = (state.uiState ?? {}) as Record<string, unknown>;

  for (const write of writes) {
    const isUi = write.path.startsWith('$ui.');
    const dotPath = isUi ? write.path.slice(4) : write.path;
    const segments = dotPath.split('.');

    for (const seg of segments) {
      assertSafeSegment(seg);
    }

    if (write.mode === 'delete') {
      if (isUi) {
        uiState = deleteNestedValue(uiState, segments);
      } else {
        data = deleteNestedValue(data, segments);
      }
    } else {
      if (isUi) {
        uiState = setNestedValue(uiState, segments, write.value);
      } else {
        data = setNestedValue(data, segments, write.value);
      }
    }
  }

  return { ...state, data, uiState };
}
