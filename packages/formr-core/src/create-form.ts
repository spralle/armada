import type { FormState, CreateFormOptions, ValidationIssue, SubmitContext, FieldMetaEntry } from './state.js';
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
import { parsePath } from './path-parser.js';
import { createFieldApi } from './field-api.js';
import { applySubmitOutcome } from './submit.js';
import { executePipeline } from './pipeline.js';
import { initMiddlewares, disposeMiddlewares, runNotifyHooksAsync } from './middleware-runner.js';
import { FormrError } from './errors.js';
import { runTransforms } from './transforms.js';
import type { TransformDefinition } from './transforms.js';
import { createArbiterAdapter, createArbiterAdapterFromSession } from './arbiter-integration.js';
import type { ArbiterFormAdapter } from './arbiter-integration.js';
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
function getEgressTransforms(options: CreateFormOptions<unknown, unknown>): readonly TransformDefinition[] {
  if (!options.transforms?.length) return [];
  return options.transforms.filter(
    (t): t is TransformDefinition => 'transform' in t && typeof (t as TransformDefinition).transform === 'function',
  );
}

import { structuredEqual } from './equality.js';

/** ADR §9 — createForm factory */
export function createForm<TData, TUi>(
  options: CreateFormOptions<TData, TUi> = {} as CreateFormOptions<TData, TUi>,
): FormApi<TData, TUi> {
  let initialDataSnapshot: TData = structuredClone((options.initialData ?? {}) as TData);
  const initialUiStateSnapshot: TUi = structuredClone((options.initialUiState ?? {}) as TUi);

  // Justified: runtime data matches TData/TUi, narrowing for consumer DX
  const initialState = {
    data: (options.initialData ?? {}) as TData,
    uiState: (options.initialUiState ?? {}) as TUi,
    meta: {
      validation: {},
    },
    fieldMeta: {},
    issues: [],
  } as FormState<TData, TUi>;

  const store = new FormStore<TData, TUi>(initialState, options.stateStrategy);

  /** Resolve a value from initialDataSnapshot by path segments */
  function resolveInitialValue(segments: readonly (string | number)[]): unknown {
    let current: unknown = initialDataSnapshot;
    for (const seg of segments) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string | number, unknown>)[seg];
    }
    return current;
  }

  // Create arbiter adapter if arbiter rules or session provided
  let arbiterAdapter: ArbiterFormAdapter | undefined;
  if (options.arbiterSession) {
    arbiterAdapter = createArbiterAdapterFromSession(options.arbiterSession);
  } else if (options.arbiterRules?.length) {
    const initialDataObj = (options.initialData ?? {}) as Readonly<Record<string, unknown>>;
    arbiterAdapter = createArbiterAdapter(options.arbiterRules, initialDataObj);
  }

  // Field cache: keyed by rawPath + serialized config
  const fieldCache = new Map<string, FieldApi<TData, TUi, string>>();

  function getIssues(path: CanonicalPath): readonly ValidationIssue[] {
    return store.getState().issues.filter(
      (issue) => pathEquals(issue.path, path) || pathStartsWith(issue.path, path),
    );
  }

  // Justified: pipeline treats data as opaque; variance cast is safe at this internal boundary
  const pipelineStore = store as unknown as import('./store.js').FormStore<unknown, unknown>;
  const pipelineOptions = options as unknown as CreateFormOptions<unknown, unknown>;

  function dispatchSetValue(rawPath: string, value: unknown): FormDispatchResult {
    const result = executePipeline({
      action: { type: 'set-value', path: rawPath, value },
      store: pipelineStore,
      options: pipelineOptions,
      isSubmit: false,
      arbiterAdapter,
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
      store: pipelineStore,
      options: pipelineOptions,
      isSubmit: false,
      arbiterAdapter,
    });
    const errorMsg2 = result.error ?? result.vetoReason;
    return errorMsg2 ? { ok: result.ok, error: errorMsg2 } : { ok: result.ok };
  }

  function validate(stage?: string): readonly ValidationIssue[] {
    const state = store.getState();
    const activeStage = stage ?? state.meta.stage;
    if (!options.validators?.length) return [];
    const allIssues: ValidationIssue[] = [];
    for (const v of options.validators) {
      const base = { data: state.data, uiState: state.uiState };
      const input = activeStage !== undefined ? { ...base, stage: activeStage } : base;
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

  async function submit(context?: Partial<SubmitContext>): Promise<SubmitResult> {
    const state = store.getState();

    if (state.meta.submission?.status === 'running') {
      return Promise.reject(
        new FormrError('FORMR_SUBMIT_CONCURRENT', 'Submit rejected: a submission is already in progress'),
      );
    }

    const submitId = generateSubmitId();
    const submitContext = buildSubmitContext(context, submitId);

    markSubmissionRunning(submitId);

    const pipelineResult = runSubmitPipeline(submitContext);

    if (!pipelineResult.ok) {
      return handlePipelineFailure(pipelineResult, submitId);
    }

    const currentIssues = store.getState().issues;
    if (currentIssues.some((i) => i.severity === 'error')) {
      return handleValidationFailure(currentIssues, submitId);
    }

    if (options.onSubmit) {
      return executeOnSubmit(submitContext, submitId);
    }

    // No onSubmit — succeed as no-op
    const txDone = store.beginTransaction();
    txDone.mutate((draft) => ({
      ...draft,
      meta: applySubmitOutcome(draft.meta, true, submitId),
    }));
    store.commitTransaction(txDone);
    return { ok: true, submitId };
  }

  function buildSubmitContext(
    context: Partial<SubmitContext> | undefined,
    submitId: string,
  ): SubmitContext {
    return {
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
        submitted: true,
        submission: { status: 'running' as const, submitId, lastAttemptAt: new Date().toISOString() },
      },
    }));
    store.commitTransaction(txStart);
  }

  function runSubmitPipeline(submitContext: SubmitContext) {
    const submitAction: FormAction = { type: 'submit' };
    return executePipeline({
      action: submitAction,
      store: pipelineStore,
      options: pipelineOptions,
      submitContext,
      isSubmit: true,
      arbiterAdapter,
    });
  }

  function handlePipelineFailure(
    pipelineResult: { readonly ok: boolean; readonly vetoReason?: string; readonly error?: string; readonly issues?: readonly ValidationIssue[] },
    submitId: string,
  ): SubmitResult {
    const txFail = store.beginTransaction();
    txFail.mutate((draft) => ({
      ...draft,
      meta: applySubmitOutcome(draft.meta, false, submitId),
    }));
    store.commitTransaction(txFail);
    return {
      ok: false,
      submitId,
      message: pipelineResult.vetoReason ?? pipelineResult.error ?? 'Pipeline failed',
      ...(pipelineResult.issues !== undefined ? { fieldIssues: pipelineResult.issues } : {}),
    };
  }

  function handleValidationFailure(
    currentIssues: readonly ValidationIssue[],
    submitId: string,
  ): SubmitResult {
    const txFail = store.beginTransaction();
    txFail.mutate((draft) => ({
      ...draft,
      meta: applySubmitOutcome(draft.meta, false, submitId),
    }));
    store.commitTransaction(txFail);
    return { ok: false, submitId, message: 'Validation failed', fieldIssues: currentIssues };
  }

  async function executeOnSubmit(
    submitContext: SubmitContext,
    submitId: string,
  ): Promise<SubmitResult> {
    const submitAction: FormAction = { type: 'submit' };
    try {
      const rawData = store.getState().data;
      const transformDefs = getEgressTransforms(pipelineOptions);
      const payload = (transformDefs.length > 0
        ? runTransforms(transformDefs, 'egress', rawData, { state: store.getState() })
        : rawData) as TData;

      const result = await withTimeout(
        options.onSubmit!({
          form: api,
          submitContext,
          payload,
        }),
        options.timeouts?.submit ?? DEFAULT_RUNTIME_CONSTRAINTS.submitTimeout,
        'onSubmit callback timed out',
      );

      const txResult = store.beginTransaction();
      txResult.mutate((draft) => ({
        ...draft,
        meta: applySubmitOutcome(draft.meta, result.ok, submitId),
        issues: [
          ...draft.issues,
          ...(result.fieldIssues ?? []),
          ...(result.globalIssues ?? []),
        ],
      }));
      store.commitTransaction(txResult);

      await runNotifyHooksAsync(
        (options.middleware ?? []) as readonly Middleware[],
        'afterSubmit',
        { action: submitAction, state: store.getState(), result },
        options.timeouts?.middleware ?? DEFAULT_RUNTIME_CONSTRAINTS.middlewareTimeout,
      );

      return result;
    } catch (err) {
      const txErr = store.beginTransaction();
      txErr.mutate((draft) => ({
        ...draft,
        meta: applySubmitOutcome(draft.meta, false, submitId),
      }));
      store.commitTransaction(txErr);
      return {
        ok: false,
        submitId,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  function markFieldTouched(pathKey: string): void {
    const tx = store.beginTransaction();
    tx.mutate((draft) => {
      const existing = (draft.fieldMeta as Record<string, FieldMetaEntry>)[pathKey];
      if (existing?.touched) return draft;
      return {
        ...draft,
        fieldMeta: {
          ...draft.fieldMeta,
          [pathKey]: { touched: true, isValidating: existing?.isValidating ?? false, dirty: existing?.dirty ?? false },
        },
      };
    });
    store.commitTransaction(tx);
  }

  function field(path: string, config?: FieldConfig): FieldApi<TData, TUi, string> {
    const cacheKey = config ? `${path}::${JSON.stringify(config)}` : path;
    const cached = fieldCache.get(cacheKey);
    if (cached) return cached;

    const canonical = parsePath(path);
    const fieldApi = createFieldApi<TData, TUi>({
      path: canonical,
      rawPath: path,
      getState: () => store.getState(),
    // Justified: runtime path parsing validates path; cast bridges generic method signature
    setValue: dispatchSetValue as FormApi<TData, TUi>['setValue'],
      getIssues: (p) => getIssues(p),
      getInitialValue: () => resolveInitialValue(canonical.segments),
      getFieldMeta: (pk) => (store.getState().fieldMeta as Record<string, FieldMetaEntry>)[pk],
      markTouched: markFieldTouched,
      getFormSubmitted: () => store.getState().meta.submitted ?? false,
      formDefaults: options.fieldDefaults,
      config,
    });

    fieldCache.set(cacheKey, fieldApi);
    return fieldApi;
  }

  function reset(nextInitial?: { readonly data?: TData; readonly uiState?: TUi }): void {
    if (nextInitial?.data !== undefined) {
      initialDataSnapshot = structuredClone(nextInitial.data);
    }
    const resetData = nextInitial?.data !== undefined ? structuredClone(nextInitial.data) : structuredClone(initialDataSnapshot);
    const resetUi = nextInitial?.uiState !== undefined ? structuredClone(nextInitial.uiState) : structuredClone(initialUiStateSnapshot);

    const tx = store.beginTransaction();
    tx.mutate(() => ({
      data: resetData,
      uiState: resetUi,
      meta: { validation: {} },
      fieldMeta: {},
      issues: [],
    } as FormState<TData, TUi>));
    store.commitTransaction(tx);
    fieldCache.clear();
  }

  const api: FormApi<TData, TUi> = {
    getState: () => store.getState(),
    dispatch,
    setValue: dispatchSetValue,
    validate,
    submit,
    // Justified: runtime path validation ensures P constraint; cast bridges generic method signature
    field: field as FormApi<TData, TUi>['field'],
    subscribe: (listener) => store.subscribe(listener),
    reset,
    dispose: () => {
      arbiterAdapter?.dispose();
      const middlewares = (options.middleware ?? []) as readonly Middleware[];
      disposeMiddlewares(middlewares);
      fieldCache.clear();
      store.dispose();
    },
  };

  // Initialize middleware lifecycle
  const middlewares = (options.middleware ?? []) as readonly Middleware[];
  initMiddlewares(middlewares, { state: initialState });

  return api;
}
