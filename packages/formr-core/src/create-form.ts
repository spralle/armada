import type { FormState, CreateFormOptions, ValidationIssue, SubmitContext } from './state.js';
import type {
  FormApi,
  FieldApi,
  FormAction,
  FormDispatchResult,
  FieldConfig,
  SubmitResult,
} from './contracts.js';
import type { Middleware } from './contracts.js';
import type { CanonicalPath } from './path.js';
import { FormStore } from './store.js';
import { createDefaultStagePolicy } from './stage-policy.js';
import { parsePath } from './path-parser.js';
import { createFieldApi } from './field-api.js';
import { applySubmitOutcome } from './submit.js';
import { executePipeline } from './pipeline.js';
import { initMiddlewares, disposeMiddlewares, runNotifyHooksAsync } from './middleware-runner.js';
import { FormrError } from './errors.js';
import { runTransforms } from './transforms.js';
import type { TransformDefinition } from './transforms.js';
import { withTimeout, DEFAULT_RUNTIME_CONSTRAINTS } from './extensions.js';

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

/** Extract TransformDefinition instances from options.transforms via duck-type check */
function getEgressTransforms<S extends string>(options: CreateFormOptions<S>): readonly TransformDefinition[] {
  if (!options.transforms?.length) return [];
  return options.transforms.filter(
    (t): t is TransformDefinition => 'transform' in t && typeof (t as TransformDefinition).transform === 'function',
  );
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

  const store = new FormStore<S>(initialState, options.stateStrategy);

  // Field cache: keyed by rawPath + serialized config
  const fieldCache = new Map<string, FieldApi>();

  function getIssues(path: CanonicalPath): readonly ValidationIssue<S>[] {
    return store.getState().issues.filter(
      (issue) => pathEquals(issue.path, path) || pathStartsWith(issue.path, path),
    );
  }

  function dispatchSetValue(rawPath: string, value: unknown): FormDispatchResult {
    const result = executePipeline({
      action: { type: 'set-value', path: rawPath, value },
      store,
      options,
      stagePolicy: policy,
      isSubmit: false,
    });
    const errorMsg = result.error ?? result.vetoReason;
    return errorMsg ? { ok: result.ok, error: errorMsg } : { ok: result.ok };
  }

  function dispatch(action: FormAction): FormDispatchResult {
    if (action.type === 'set-value' && action.path !== undefined) {
      return dispatchSetValue(action.path, action.value);
    }

    const result = executePipeline({
      action,
      store,
      options,
      stagePolicy: policy,
      isSubmit: false,
    });
    const errorMsg2 = result.error ?? result.vetoReason;
    return errorMsg2 ? { ok: result.ok, error: errorMsg2 } : { ok: result.ok };
  }

  function validate(stage?: S): readonly ValidationIssue<S>[] {
    const state = store.getState();
    const activeStage = stage ?? state.meta.stage;
    if (!options.validators?.length) return [];
    const allIssues: ValidationIssue<S>[] = [];
    for (const v of options.validators) {
      const input = { data: state.data, uiState: state.uiState, stage: activeStage };
      const result = v.validate(input);
      if (result instanceof Promise) {
        throw new FormrError(
          'FORMR_ASYNC_IN_SYNC_PIPELINE',
          `Validator "${v.id}" returned a Promise in synchronous validate() — use async submit path`,
        );
      }
      allIssues.push(...result);
    }
    return allIssues;
  }

  async function submit(context?: Partial<SubmitContext<S>>): Promise<SubmitResult<S>> {
    const state = store.getState();

    if (state.meta.submission?.status === 'running') {
      return Promise.reject(
        new FormrError('FORMR_SUBMIT_CONCURRENT', 'Submit rejected: a submission is already in progress'),
      );
    }

    const submitId = generateSubmitId();
    const submitContext = buildSubmitContext(state, context, submitId);

    markSubmissionRunning(submitId);

    const pipelineResult = runSubmitPipeline(submitContext);

    if (!pipelineResult.ok) {
      return handlePipelineFailure(pipelineResult, submitContext, submitId);
    }

    const currentIssues = store.getState().issues;
    if (currentIssues.some((i) => i.severity === 'error')) {
      return handleValidationFailure(currentIssues, submitContext, submitId);
    }

    if (options.onSubmit) {
      return executeOnSubmit(submitContext, submitId);
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

  function buildSubmitContext(
    state: FormState<S>,
    context: Partial<SubmitContext<S>> | undefined,
    submitId: string,
  ): SubmitContext<S> {
    return {
      requestedStage: context?.requestedStage ?? state.meta.stage,
      mode: context?.mode ?? 'persistent',
      requestId: context?.requestId ?? submitId,
      at: context?.at ?? new Date().toISOString(),
      ...(context?.actorId !== undefined ? { actorId: context.actorId } : {}),
      ...(context?.metadata !== undefined ? { metadata: context.metadata } : {}),
    };
  }

  function markSubmissionRunning(submitId: string): void {
    const txStart = store.beginTransaction();
    txStart.mutate((draft) => ({
      ...draft,
      meta: {
        ...draft.meta,
        submission: { status: 'running' as const, submitId, lastAttemptAt: new Date().toISOString() },
      },
    }));
    store.commitTransaction(txStart);
  }

  function runSubmitPipeline(submitContext: SubmitContext<S>) {
    const submitAction: FormAction = { type: 'submit' };
    return executePipeline({
      action: submitAction,
      store,
      options,
      stagePolicy: policy,
      submitContext,
      isSubmit: true,
    });
  }

  function handlePipelineFailure(
    pipelineResult: { readonly ok: boolean; readonly vetoReason?: string; readonly error?: string; readonly issues?: readonly ValidationIssue[] },
    submitContext: SubmitContext<S>,
    submitId: string,
  ): SubmitResult<S> {
    const txFail = store.beginTransaction();
    txFail.mutate((draft) => ({
      ...draft,
      meta: applySubmitOutcome(draft.meta, submitContext, false, submitId),
    }));
    store.commitTransaction(txFail);
    return {
      ok: false,
      submitId,
      message: pipelineResult.vetoReason ?? pipelineResult.error ?? 'Pipeline failed',
      fieldIssues: pipelineResult.issues as readonly ValidationIssue<S>[],
    };
  }

  function handleValidationFailure(
    currentIssues: readonly ValidationIssue<S>[],
    submitContext: SubmitContext<S>,
    submitId: string,
  ): SubmitResult<S> {
    const txFail = store.beginTransaction();
    txFail.mutate((draft) => ({
      ...draft,
      meta: applySubmitOutcome(draft.meta, submitContext, false, submitId),
    }));
    store.commitTransaction(txFail);
    return { ok: false, submitId, message: 'Validation failed', fieldIssues: currentIssues };
  }

  async function executeOnSubmit(
    submitContext: SubmitContext<S>,
    submitId: string,
  ): Promise<SubmitResult<S>> {
    const submitAction: FormAction = { type: 'submit' };
    try {
      const rawData = store.getState().data;
      const transformDefs = getEgressTransforms(options);
      const payload = transformDefs.length > 0
        ? runTransforms(transformDefs, 'egress', rawData, { state: store.getState() })
        : rawData;

      const result = await withTimeout(
        options.onSubmit!({
          form: api,
          submitContext,
          payload,
          stage: submitContext.requestedStage,
        }),
        options.timeouts?.submit ?? DEFAULT_RUNTIME_CONSTRAINTS.submitTimeout,
        'onSubmit callback timed out',
      );

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

      await runNotifyHooksAsync(
        (options.middleware ?? []) as readonly Middleware<S>[],
        'afterSubmit',
        { action: submitAction, state: store.getState(), result },
        options.timeouts?.middleware ?? DEFAULT_RUNTIME_CONSTRAINTS.middlewareTimeout,
      );

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
      formDefaults: options.fieldDefaults as FieldConfig | undefined,
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
    dispose: () => {
      const middlewares = (options.middleware ?? []) as readonly Middleware<S>[];
      disposeMiddlewares(middlewares);
      fieldCache.clear();
      store.dispose();
    },
  };

  // Initialize middleware lifecycle
  const middlewares = (options.middleware ?? []) as readonly Middleware<S>[];
  initMiddlewares(middlewares, { state: initialState });

  return api;
}
