import type { CanonicalPath } from './path.js';
import type { FormState, ValidationIssue, SubmitContext } from './state.js';
import type { ExprNode, ExpressionDefinition, EvaluationScope } from '@ghost/predicate';
import type { TransformDefinition } from './transforms.js';

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
  readonly state: FormState;
}

/** Context for afterAction hook */
export interface AfterActionContext {
  readonly action: FormAction;
  readonly prevState: FormState;
  readonly nextState: FormState;
}

/** Context for beforeEvaluate hook */
export interface BeforeEvaluateContext {
  readonly action: FormAction;
  readonly state: FormState;
}

/** Context for afterEvaluate hook */
export interface AfterEvaluateContext {
  readonly action: FormAction;
  readonly state: FormState;
}

/** Context for beforeValidate hook */
export interface BeforeValidateContext {
  readonly action: FormAction;
  readonly state: FormState;
  readonly stage?: string;
}

/** Context for afterValidate hook */
export interface AfterValidateContext {
  readonly action: FormAction;
  readonly state: FormState;
  readonly issues: readonly ValidationIssue[];
}

/** Context for beforeSubmit hook */
export interface BeforeSubmitContext {
  readonly action: FormAction;
  readonly state: FormState;
  readonly submitContext: SubmitContext;
}

/** Context for afterSubmit hook */
export interface AfterSubmitContext {
  readonly action: FormAction;
  readonly state: FormState;
  readonly result: SubmitResult;
}

/** Context for middleware init */
export interface MiddlewareInitContext {
  readonly state: FormState;
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
export interface SubmitExecutionContext {
  readonly form: FormApi;
  readonly submitContext: SubmitContext;
  readonly payload: unknown;
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
export interface FormApi {
  getState(): FormState;
  dispatch(action: FormAction): FormDispatchResult;
  setValue(path: string, value: unknown): FormDispatchResult;
  validate(stage?: string): readonly ValidationIssue[];
  submit(context?: Partial<SubmitContext>): Promise<SubmitResult>;
  field(path: string, config?: FieldConfig): FieldApi;
  subscribe(listener: (state: FormState) => void): () => void;
  dispose(): void;
}
