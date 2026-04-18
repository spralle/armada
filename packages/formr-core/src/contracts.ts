import type { CanonicalPath } from './path.js';
import type { FormState, ValidationIssue, SubmitContext } from './state.js';
import type { ExprNode, ExpressionDefinition, EvaluationScope } from '@ghost/predicate';

export type { ExprNode, ExpressionDefinition, EvaluationScope };

/** Backward-compat alias — prefer EvaluationScope in new code */
export type ExpressionScope = EvaluationScope;
export interface ValidatorAdapter<S extends string = string> {
  readonly id: string;
  supports(schema: unknown): boolean;
  validate(input: {
    readonly data: unknown;
    readonly uiState: unknown;
    readonly stage: S;
    readonly context?: SubmitContext<S>;
  }): Promise<readonly ValidationIssue<S>[]> | readonly ValidationIssue<S>[];
}

/** ADR section 5.2 — RuleDefinition */
export interface RuleDefinition {
  readonly id: string;
  readonly when: ExprNode;
  readonly writes: readonly RuleWrite[];
}

/** ADR section 5.2 — RuleWrite */
export interface RuleWrite {
  readonly path: string;
  readonly value: ExprNode;
  readonly mode: 'set' | 'delete';
}

/** ADR section 5.2 — RuleWriteIntent */
export interface RuleWriteIntent {
  readonly path: string;
  readonly value: unknown;
  readonly mode: 'set' | 'delete';
  readonly ruleId: string;
}

/** ADR section 9 — ExpressionEngine */
export interface ExpressionEngine {
  readonly id: string;
  evaluate(node: ExprNode, scope: EvaluationScope): unknown;
}

/** ADR section 9 — Middleware decision for veto-capable hooks */
export type MiddlewareDecision =
  | { readonly action: 'continue' }
  | { readonly action: 'veto'; readonly reason: string };

/** Context for beforeAction hook */
export interface BeforeActionContext<S extends string = string> {
  readonly action: FormAction;
  readonly state: FormState<S>;
}

/** Context for afterAction hook */
export interface AfterActionContext<S extends string = string> {
  readonly action: FormAction;
  readonly prevState: FormState<S>;
  readonly nextState: FormState<S>;
}

/** Context for beforeEvaluate hook */
export interface BeforeEvaluateContext<S extends string = string> {
  readonly action: FormAction;
  readonly state: FormState<S>;
}

/** Context for afterEvaluate hook */
export interface AfterEvaluateContext<S extends string = string> {
  readonly action: FormAction;
  readonly state: FormState<S>;
}

/** Context for beforeValidate hook */
export interface BeforeValidateContext<S extends string = string> {
  readonly action: FormAction;
  readonly state: FormState<S>;
  readonly stage: S;
}

/** Context for afterValidate hook */
export interface AfterValidateContext<S extends string = string> {
  readonly action: FormAction;
  readonly state: FormState<S>;
  readonly issues: readonly ValidationIssue<S>[];
}

/** Context for beforeSubmit hook */
export interface BeforeSubmitContext<S extends string = string> {
  readonly action: FormAction;
  readonly state: FormState<S>;
  readonly submitContext: SubmitContext<S>;
}

/** Context for afterSubmit hook */
export interface AfterSubmitContext<S extends string = string> {
  readonly action: FormAction;
  readonly state: FormState<S>;
  readonly result: SubmitResult<S>;
}

/** Context for middleware init */
export interface MiddlewareInitContext<S extends string = string> {
  readonly state: FormState<S>;
}

/** ADR section 9 — Middleware with full lifecycle hooks */
export interface Middleware<S extends string = string> {
  readonly id: string;
  onInit?(ctx: MiddlewareInitContext<S>): void;
  beforeAction?(ctx: BeforeActionContext<S>): MiddlewareDecision | Promise<MiddlewareDecision>;
  afterAction?(ctx: AfterActionContext<S>): void;
  beforeEvaluate?(ctx: BeforeEvaluateContext<S>): void;
  afterEvaluate?(ctx: AfterEvaluateContext<S>): void;
  beforeValidate?(ctx: BeforeValidateContext<S>): void;
  afterValidate?(ctx: AfterValidateContext<S>): void;
  beforeSubmit?(ctx: BeforeSubmitContext<S>): MiddlewareDecision | Promise<MiddlewareDecision>;
  afterSubmit?(ctx: AfterSubmitContext<S>): void;
  onDispose?(): void;
}

/** ADR section 10 — Transform (stub — full in SE6.1) */
export interface Transform {
  readonly id: string;
}

/** ADR section 9 — SubmitExecutionContext */
export interface SubmitExecutionContext<S extends string = string> {
  readonly form: FormApi<S>;
  readonly submitContext: SubmitContext<S>;
  readonly payload: unknown;
  readonly stage: S;
}

/** ADR section 9 — SubmitResult */
export interface SubmitResult<S extends string = string> {
  readonly ok: boolean;
  readonly submitId: string;
  readonly message?: string;
  readonly fieldIssues?: readonly ValidationIssue<S>[];
  readonly globalIssues?: readonly ValidationIssue<S>[];
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

/** ADR section 9.1 — FieldConfig */
export interface FieldConfig<S extends string = string> {
  readonly label?: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly validators?: readonly ValidatorAdapter<S>[];
  readonly transforms?: readonly Transform[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** ADR section 9 — FieldApi */
export interface FieldApi {
  readonly path: CanonicalPath;
  get(): unknown;
  set(value: unknown): FormDispatchResult;
  validate(): readonly ValidationIssue[];
  issues(): readonly ValidationIssue[];
  ui<T = unknown>(selector: (uiState: unknown) => T): T;
}

/** ADR section 9 — FormApi */
export interface FormApi<S extends string = string> {
  getState(): FormState<S>;
  dispatch(action: FormAction): FormDispatchResult;
  setValue(path: string, value: unknown): FormDispatchResult;
  validate(stage?: S): readonly ValidationIssue<S>[];
  submit(context?: Partial<SubmitContext<S>>): Promise<SubmitResult<S>>;
  field(path: string, config?: FieldConfig<S>): FieldApi;
  subscribe(listener: (state: FormState<S>) => void): () => void;
  dispose(): void;
}
