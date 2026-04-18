import type { CanonicalPath } from './path.js';
import type { FormState, ValidationIssue, SubmitContext } from './state.js';

/** ADR section 9 — ValidatorAdapter */
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

/** ADR section 5.2 — ExprNode AST discriminated union */
export type ExprNode =
  | {
      readonly kind: 'literal';
      readonly value: string | number | boolean | null;
    }
  | { readonly kind: 'path'; readonly path: string }
  | {
      readonly kind: 'op';
      readonly op: string;
      readonly args: readonly ExprNode[];
    };

/** ADR section 5.2 — ExpressionDefinition */
export interface ExpressionDefinition {
  readonly id: string;
  readonly ast: ExprNode;
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

/** ADR section 9 — ExpressionScope */
export interface ExpressionScope {
  readonly data: unknown;
  readonly uiState: unknown;
  readonly meta: unknown;
}

/** ADR section 9 — ExpressionEngine */
export interface ExpressionEngine {
  readonly id: string;
  evaluate(node: ExprNode, scope: ExpressionScope): unknown;
  evaluateRule(
    rule: RuleDefinition,
    scope: ExpressionScope,
  ): readonly RuleWriteIntent[];
}

/** ADR section 9 — Middleware (stub — full hooks in SE6.2) */
export interface Middleware<S extends string = string> {
  readonly id: string;
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
  validate(): ValidationIssue[];
  issues(): readonly ValidationIssue[];
  ui<T = unknown>(selector: (uiState: unknown) => T): T;
}

/** ADR section 9 — FormApi */
export interface FormApi<S extends string = string> {
  getState(): FormState<S>;
  dispatch(action: FormAction): FormDispatchResult;
  setValue(path: string, value: unknown): FormDispatchResult;
  validate(stage?: S): ValidationIssue<S>[];
  submit(context?: Partial<SubmitContext<S>>): Promise<SubmitResult>;
  field(path: string, config?: FieldConfig): FieldApi;
  subscribe(listener: (state: FormState<S>) => void): () => void;
  dispose(): void;
}
