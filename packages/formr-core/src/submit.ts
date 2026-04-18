import type { FormState, SubmitContext } from './state.js';

/** ADR section 2.4 — resolve active stage for validation */
export function resolveActiveStage<S extends string>(
  currentMeta: FormState<S>['meta'],
  submitContext: SubmitContext<S> | undefined,
): S {
  if (submitContext && submitContext.mode === 'transient') {
    return submitContext.requestedStage;
  }
  return currentMeta.stage;
}

/** ADR section 2.4 — apply submit outcome to meta */
export function applySubmitOutcome<S extends string>(
  meta: FormState<S>['meta'],
  submitContext: SubmitContext<S>,
  success: boolean,
  submitId: string,
): FormState<S>['meta'] {
  const now = new Date().toISOString();

  if (submitContext.mode === 'persistent' && success) {
    return {
      ...meta,
      stage: submitContext.requestedStage,
      validation: {
        ...meta.validation,
        lastEvaluatedStage: submitContext.requestedStage,
        lastValidatedAt: now,
      },
      submission: {
        status: 'succeeded',
        submitId,
        lastAttemptAt: now,
        lastResultAt: now,
      },
    };
  }

  if (submitContext.mode === 'persistent' && !success) {
    return {
      ...meta,
      validation: {
        ...meta.validation,
        lastEvaluatedStage: submitContext.requestedStage,
        lastValidatedAt: now,
      },
      submission: {
        status: 'failed',
        submitId,
        lastAttemptAt: now,
        lastResultAt: now,
      },
    };
  }

  // Transient mode — never mutate meta.stage
  return {
    ...meta,
    validation: {
      ...meta.validation,
      lastEvaluatedStage: submitContext.requestedStage,
      lastValidatedAt: now,
    },
    submission: {
      status: success ? 'succeeded' : 'failed',
      submitId,
      lastAttemptAt: now,
      lastResultAt: now,
    },
  };
}
