import type { CanonicalPath } from './path.js';

/** ADR section 6.2 */
export type IssueSeverity = 'error' | 'warning' | 'info';

/** ADR section 2.1 */
export type SubmitMode = 'persistent' | 'transient';

/** ADR section 6.2 — ValidationIssue */
export interface ValidationIssue<S extends string = string> {
  readonly code: string;
  readonly message: string;
  readonly severity: IssueSeverity;
  readonly stage: S;
  readonly path: CanonicalPath;
  readonly source: {
    readonly origin:
      | 'standard-schema'
      | 'function-validator'
      | 'json-schema-adapter'
      | 'rule'
      | 'middleware';
    readonly validatorId: string;
    readonly adapterId?: string;
    readonly ruleId?: string;
  };
  readonly details?: Readonly<Record<string, unknown>>;
}

/** ADR section 2.1 — SubmitContext */
export interface SubmitContext<S extends string = string> {
  readonly requestedStage: S;
  readonly mode: SubmitMode;
  readonly actorId?: string;
  readonly requestId: string;
  readonly at: string; // ISO-8601 UTC
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** ADR section 1.1 — FormState */
export interface FormState<S extends string = 'draft' | 'submit' | 'approve'> {
  readonly data: unknown;
  readonly uiState: unknown;
  readonly meta: {
    readonly stage: S;
    readonly validation: {
      readonly lastEvaluatedStage?: S;
      readonly lastValidatedAt?: string; // ISO-8601 UTC
    };
    readonly submission?: {
      readonly status: 'idle' | 'running' | 'succeeded' | 'failed';
      readonly submitId?: string;
      readonly lastAttemptAt?: string; // ISO-8601 UTC
      readonly lastResultAt?: string; // ISO-8601 UTC
      readonly lastErrorCode?: string;
    };
  };
  readonly issues: readonly ValidationIssue<S>[];
}

/** ADR section 9 — StageTransitionRule */
export interface StageTransitionRule<S extends string> {
  readonly from: S;
  readonly to: S;
  readonly reason?: string;
}

/** ADR section 9 — StagePolicy */
export interface StagePolicy<S extends string> {
  readonly orderedStages: readonly S[];
  readonly defaultStage: S;
  isKnownStage(stage: string): stage is S;
  canTransition(from: S, to: S): boolean;
  describeTransition(from: S, to: S): StageTransitionRule<S> | null;
}

/** ADR section 9 — CreateFormOptions */
export interface CreateFormOptions<
  S extends string = 'draft' | 'submit' | 'approve',
> {
  readonly schema?: unknown;
  readonly uiStateSchema?: unknown;
  readonly initialData?: unknown;
  readonly initialUiState?: unknown;
  readonly stagePolicy?: StagePolicy<S>;
  readonly validators?: readonly ValidatorAdapter<S>[];
  readonly expressionEngine?: ExpressionEngine;
  readonly rules?: readonly RuleDefinition[];
  readonly middleware?: readonly Middleware<S>[];
  readonly transforms?: readonly Transform[];
  readonly onSubmit?: (
    ctx: SubmitExecutionContext<S>,
  ) => Promise<SubmitResult<S>>;
}

// Imports for CreateFormOptions references
import type {
  ValidatorAdapter,
  ExpressionEngine,
  RuleDefinition,
  Middleware,
  Transform,
  SubmitExecutionContext,
  SubmitResult,
} from './contracts.js';
