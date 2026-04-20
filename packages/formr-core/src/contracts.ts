import type { CanonicalPath } from './path.js';
import type { FormState, ValidationIssue, SubmitContext } from './state.js';
import type { ExprNode, ExpressionDefinition, EvaluationScope } from '@ghost/predicate';
import type { TransformDefinition } from './transforms.js';
import type { DeepKeys, DeepValue } from './type-utils.js';

export type { ExprNode, ExpressionDefinition, EvaluationScope };

// Re-export arbiter types for consumers
export type { ProductionRule, RuleSession, SessionConfig as ArbiterSessionConfig } from '@ghost/arbiter';

/**
 * ADR section 10 — Transform is the config-time type alias.
 * TransformDefinition (from transforms.ts) is the full runtime type with transform().
 */
export type Transform = TransformDefinition;

/** Backward-compat alias — prefer EvaluationScope in new code */
export type ExpressionScope = EvaluationScope;
export interface ValidatorAdapter {
  readonly id: string;
  supports(schema: unknown): boolean;
  validate(input: {
    readonly data: unknown;
    readonly uiState: unknown;
    readonly stage?: string;
    readonly context?: SubmitContext;
  }): Promise<readonly ValidationIssue[]> | readonly ValidationIssue[];
}

/** ADR section 5.2 — RuleWriteIntent */
export interface RuleWriteIntent {
  readonly path: string;
  readonly value: unknown;
  readonly mode: 'set' | 'delete';
  readonly ruleId: string;
}

/** ADR section 9 — Middleware decision for veto-capable hooks */
export type MiddlewareDecision =
  | { readonly action: 'continue' }
  | { readonly action: 'veto'; readonly reason: string };

/** Context for beforeAction hook */
export interface BeforeActionContext {
  readonly action: FormAction;
  readonly state: FormState<unknown, unknown>;
}

/** Context for afterAction hook */
export interface AfterActionContext {
  readonly action: FormAction;
  readonly prevState: FormState<unknown, unknown>;
  readonly nextState: FormState<unknown, unknown>;
}

/** Context for beforeEvaluate hook */
export interface BeforeEvaluateContext {
  readonly action: FormAction;
  readonly state: FormState<unknown, unknown>;
}

/** Context for afterEvaluate hook */
export interface AfterEvaluateContext {
  readonly action: FormAction;
  readonly state: FormState<unknown, unknown>;
}

/** Context for beforeValidate hook */
export interface BeforeValidateContext {
  readonly action: FormAction;
  readonly state: FormState<unknown, unknown>;
  readonly stage?: string;
}

/** Context for afterValidate hook */
export interface AfterValidateContext {
  readonly action: FormAction;
  readonly state: FormState<unknown, unknown>;
  readonly issues: readonly ValidationIssue[];
}

/** Context for beforeSubmit hook */
export interface BeforeSubmitContext {
  readonly action: FormAction;
  readonly state: FormState<unknown, unknown>;
  readonly submitContext: SubmitContext;
}

/** Context for afterSubmit hook */
export interface AfterSubmitContext {
  readonly action: FormAction;
  readonly state: FormState<unknown, unknown>;
  readonly result: SubmitResult;
}

/** Context for middleware init */
export interface MiddlewareInitContext {
  readonly state: FormState<unknown, unknown>;
}

/** ADR section 9 — Middleware with full lifecycle hooks */
export interface Middleware {
  readonly id: string;
  onInit?(ctx: MiddlewareInitContext): void;
  beforeAction?(ctx: BeforeActionContext): MiddlewareDecision | Promise<MiddlewareDecision>;
  afterAction?(ctx: AfterActionContext): void;
  beforeEvaluate?(ctx: BeforeEvaluateContext): void;
  afterEvaluate?(ctx: AfterEvaluateContext): void;
  beforeValidate?(ctx: BeforeValidateContext): void;
  afterValidate?(ctx: AfterValidateContext): void;
  beforeSubmit?(ctx: BeforeSubmitContext): MiddlewareDecision | Promise<MiddlewareDecision>;
  afterSubmit?(ctx: AfterSubmitContext): void;
  onDispose?(): void;
}

/** ADR section 9 — SubmitExecutionContext */
export interface SubmitExecutionContext<TData, TUi> {
  readonly form: FormApi<TData, TUi>;
  readonly submitContext: SubmitContext;
  readonly payload: TData;
}

/** ADR section 9 — SubmitResult */
export interface SubmitResult {
  readonly ok: boolean;
  readonly submitId: string;
  readonly message?: string;
  readonly fieldIssues?: readonly ValidationIssue[];
  readonly globalIssues?: readonly ValidationIssue[];
}

/** ADR section 9 — FormAction */
export interface FormAction {
  readonly type: string;
  readonly path?: string;
  readonly value?: unknown;
}

/** ADR section 9 — FormDispatchResult */
export interface FormDispatchResult {
  readonly ok: boolean;
  readonly error?: string;
}

/** When an issue becomes visible to the user */
export type ValidationTrigger = 'onChange' | 'onBlur' | 'onSubmit' | 'onMount';

/** Per-field validation gating config */
export interface FieldValidationTriggers {
  /** Show issues when field value changes (field is dirty). Default trigger. */
  readonly onChange?: boolean;
  /** Show issues when field loses focus (field is touched via markTouched). */
  readonly onBlur?: boolean;
  /** Show issues only after form.submit() is called. */
  readonly onSubmit?: boolean;
  /** Show issues immediately on mount. */
  readonly onMount?: boolean;
}

/** ADR section 9.1 — FieldConfig */
export interface FieldConfig {
  readonly label?: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly validators?: readonly ValidatorAdapter[];
  readonly transforms?: readonly Transform[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly validationTriggers?: FieldValidationTriggers;
}

/** ADR section 9 — FieldApi */
export interface FieldApi<TData, TUi, TPath extends string> {
  readonly path: CanonicalPath;
  get(): DeepValue<TData, TPath>;
  set(value: DeepValue<TData, TPath>): FormDispatchResult;
  validate(): readonly ValidationIssue[];
  issues(): readonly ValidationIssue[];
  ui<T = unknown>(selector: (uiState: TUi) => T): T;
  isTouched(): boolean;
  isDirty(): boolean;
  isValidating(): boolean;
  markTouched(): void;
}

/** ADR section 9 — FormApi */
export interface FormApi<TData, TUi> {
  getState(): FormState<TData, TUi>;
  dispatch(action: FormAction): FormDispatchResult;
  setValue<P extends string & DeepKeys<TData>>(path: P, value: DeepValue<TData, P>): FormDispatchResult;
  validate(stage?: string): readonly ValidationIssue[];
  submit(context?: Partial<SubmitContext>): Promise<SubmitResult>;
  field<P extends string & DeepKeys<TData>>(path: P, config?: FieldConfig): FieldApi<TData, TUi, P>;
  subscribe(listener: (state: FormState<TData, TUi>) => void): () => void;
  /** Reset form to initial or provided state */
  reset(nextInitial?: { readonly data?: TData; readonly uiState?: TUi }): void;
  dispose(): void;
}
