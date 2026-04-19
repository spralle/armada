import type { RuleWriteIntent } from './contracts.js';
import type { FormState } from './state.js';
import { setNestedValue, deleteNestedValue } from './nested-utils.js';
import { assertSafeSegment } from '@ghost/predicate';

/** Apply rule writes to form state (immutable) */
export function applyRuleWrites(
  state: FormState,
  writes: readonly RuleWriteIntent[],
): FormState {
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
