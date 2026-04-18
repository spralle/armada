import type { FormState, CreateFormOptions, ValidationIssue, SubmitContext } from './state.js';
import type {
  FormApi,
  FieldApi,
  FormAction,
  FormDispatchResult,
  FieldConfig,
  SubmitResult,
} from './contracts.js';
import type { CanonicalPath } from './path.js';
import { FormStore } from './store.js';
import { createDefaultStagePolicy } from './stage-policy.js';
import { parsePath } from './path-parser.js';
import { createFieldApi } from './field-api.js';
import { applySubmitOutcome } from './submit.js';
import { evaluateExpressions, applyRuleWrites } from './expression-integration.js';

/** Set a value at a dot/bracket path inside a nested object, returning a new root */
function setAtPath(root: unknown, segments: readonly (string | number)[], value: unknown): unknown {
  if (segments.length === 0) return value;

  const [head, ...rest] = segments;
  if (Array.isArray(root)) {
    const result = [...root];
    (result as unknown as Record<string | number, unknown>)[head] = setAtPath(result[head as number], rest, value);
    return result;
  }
  const obj = (root ?? {}) as Record<string, unknown>;
  return { ...obj, [head]: setAtPath(obj[String(head)], rest, value) };
}

/** Check if two CanonicalPaths are equal */
function pathEquals(a: CanonicalPath, b: CanonicalPath): boolean {
  if (a.namespace !== b.namespace) return false;
  if (a.segments.length !== b.segments.length) return false;
  return a.segments.every((seg, i) => seg === b.segments[i]);
}

/** Check if a path starts with a given prefix */
function pathStartsWith(path: CanonicalPath, prefix: CanonicalPath): boolean {
  if (path.namespace !== prefix.namespace) return false;
  if (path.segments.length < prefix.segments.length) return false;
  return prefix.segments.every((seg, i) => seg === path.segments[i]);
}

function generateSubmitId(): string {
  return `submit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** ADR §9 — createForm factory */
export function createForm<S extends string = 'draft' | 'submit' | 'approve'>(
  options: CreateFormOptions<S> = {} as CreateFormOptions<S>,
): FormApi<S> {
  const stagePolicy = options.stagePolicy ?? createDefaultStagePolicy() as unknown as typeof options.stagePolicy;
  const policy = stagePolicy!;

  const initialState: FormState<S> = {
    data: options.initialData ?? {},
    uiState: options.initialUiState ?? {},
    meta: {
      stage: policy.defaultStage,
      validation: {},
    },
    issues: [],
  };

  const store = new FormStore<S>(initialState);

  // Field cache: keyed by rawPath + serialized config
  const fieldCache = new Map<string, FieldApi>();

  function getIssues(path: CanonicalPath): readonly ValidationIssue<S>[] {
    return store.getState().issues.filter(
      (issue) => pathEquals(issue.path, path) || pathStartsWith(issue.path, path),
    );
  }

  function dispatchSetValue(rawPath: string, value: unknown): FormDispatchResult {
    const canonical = parsePath(rawPath);
    const tx = store.beginTransaction();
    try {
      tx.mutate((draft) => {
        if (canonical.namespace === 'ui') {
          return { ...draft, uiState: setAtPath(draft.uiState, canonical.segments, value) };
        }
        return { ...draft, data: setAtPath(draft.data, canonical.segments, value) };
      });

      // Step 7 of ADR §8: evaluate expressions/rules
      if (options.expressionEngine && options.rules?.length) {
        tx.mutate((draft) => {
          const writes = evaluateExpressions(options.expressionEngine!, draft, options.rules!);
          if (writes.length > 0) {
            return applyRuleWrites(draft, writes);
          }
          return draft;
        });
      }

      store.commitTransaction(tx);
      return { ok: true };
    } catch (err) {
      store.rollbackTransaction(tx);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  function dispatch(action: FormAction): FormDispatchResult {
    if (action.type === 'set-value' && action.path !== undefined) {
      return dispatchSetValue(action.path, action.value);
    }

    // Generic action: begin tx, commit (no-op mutation for unknown types)
    const tx = store.beginTransaction();
    try {
      store.commitTransaction(tx);
      return { ok: true };
    } catch (err) {
      store.rollbackTransaction(tx);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  function validate(stage?: S): ValidationIssue<S>[] {
    // Validators will be wired in SE6; return empty for now
    return [];
  }

  async function submit(context?: Partial<SubmitContext<S>>): Promise<SubmitResult> {
    const submitId = generateSubmitId();
    const state = store.getState();

    const submitContext: SubmitContext<S> = {
      requestedStage: context?.requestedStage ?? state.meta.stage,
      mode: context?.mode ?? 'persistent',
      requestId: context?.requestId ?? submitId,
      at: context?.at ?? new Date().toISOString(),
      ...(context?.actorId !== undefined ? { actorId: context.actorId } : {}),
      ...(context?.metadata !== undefined ? { metadata: context.metadata } : {}),
    };

    // Mark submission as running
    const txStart = store.beginTransaction();
    txStart.mutate((draft) => ({
      ...draft,
      meta: {
        ...draft.meta,
        submission: { status: 'running' as const, submitId, lastAttemptAt: new Date().toISOString() },
      },
    }));
    store.commitTransaction(txStart);

    // Validate
    const issues = validate(submitContext.requestedStage);
    if (issues.some((i) => i.severity === 'error')) {
      const txFail = store.beginTransaction();
      txFail.mutate((draft) => ({
        ...draft,
        issues,
        meta: applySubmitOutcome(draft.meta, submitContext, false, submitId),
      }));
      store.commitTransaction(txFail);
      return { ok: false, submitId, message: 'Validation failed', fieldIssues: issues };
    }

    // Call onSubmit if provided
    if (options.onSubmit) {
      try {
        const result = await options.onSubmit({
          form: api,
          submitContext,
          payload: store.getState().data,
          stage: submitContext.requestedStage,
        });

        const txResult = store.beginTransaction();
        txResult.mutate((draft) => ({
          ...draft,
          meta: applySubmitOutcome(draft.meta, submitContext, result.ok, submitId),
          issues: [
            ...draft.issues,
            ...((result.fieldIssues ?? []) as readonly ValidationIssue<S>[]),
            ...((result.globalIssues ?? []) as readonly ValidationIssue<S>[]),
          ],
        }));
        store.commitTransaction(txResult);
        return result;
      } catch (err) {
        const txErr = store.beginTransaction();
        txErr.mutate((draft) => ({
          ...draft,
          meta: applySubmitOutcome(draft.meta, submitContext, false, submitId),
        }));
        store.commitTransaction(txErr);
        return {
          ok: false,
          submitId,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // No onSubmit — succeed as no-op
    const txDone = store.beginTransaction();
    txDone.mutate((draft) => ({
      ...draft,
      meta: applySubmitOutcome(draft.meta, submitContext, true, submitId),
    }));
    store.commitTransaction(txDone);
    return { ok: true, submitId };
  }

  function field(path: string, config?: FieldConfig): FieldApi {
    const cacheKey = config ? `${path}::${JSON.stringify(config)}` : path;
    const cached = fieldCache.get(cacheKey);
    if (cached) return cached;

    const canonical = parsePath(path);
    const fieldApi = createFieldApi({
      path: canonical,
      rawPath: path,
      getState: () => store.getState() as FormState,
      setValue: dispatchSetValue,
      getIssues: (p) => getIssues(p) as readonly ValidationIssue[],
      config,
    });

    fieldCache.set(cacheKey, fieldApi);
    return fieldApi;
  }

  const api: FormApi<S> = {
    getState: () => store.getState(),
    dispatch,
    setValue: dispatchSetValue,
    validate,
    submit,
    field,
    subscribe: (listener) => store.subscribe(listener),
    dispose: () => store.dispose(),
  };

  return api;
}
