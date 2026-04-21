// Path system (SE1.1)
export { type Namespace, type CanonicalSegment, type CanonicalPath } from './path.js';
export { parsePath, toPointer, toDot } from './path-parser.js';
export { FormrError, type FormrErrorCode } from './errors.js';

// State types (SE1.2)
export {
  type IssueSeverity,
  type ValidationIssue,
  type SubmitContext,
  type FormState,
  type CreateFormOptions,
  type FieldMetaEntry,
} from './state.js';

// Contract types (SE1.2)
export {
  type ValidatorFn,
  type ValidatorInput,
  type ExprNode,
  type ExpressionDefinition,
  type EvaluationScope,
  type ExpressionScope,
  type RuleWriteIntent,
  type Middleware,
  type MiddlewareDecision,
  type BeforeActionContext,
  type AfterActionContext,
  type BeforeEvaluateContext,
  type AfterEvaluateContext,
  type BeforeValidateContext,
  type AfterValidateContext,
  type BeforeSubmitContext,
  type AfterSubmitContext,
  type MiddlewareInitContext,
  type Transform,
  type SubmitExecutionContext,
  type SubmitResult,
  type FormAction,
  type FormDispatchResult,
  type FieldConfig,
  type FieldApi,
  type FormApi,
  type ProductionRule,
  type RuleSession,
  type ArbiterSessionConfig,
  type ValidationTrigger,
  type FieldValidationTriggers,
  type ArrayFieldHelpers,
  type FieldApiWithArray,
  type AsyncValidatorConfig,
} from './contracts.js';

// Submit helpers
export { applySubmitOutcome } from './submit.js';

// Transaction model (SE1.3)
export { Transaction, defaultStrategy, type TransactionSnapshot, type StateStrategy } from './transaction.js';
export { FormStore, type StateListener } from './store.js';
export { deepFreeze } from './utils.js';

// Form factory (SE1.4)
export { createForm } from './create-form.js';
export { createFieldApi, mergeFieldConfig, type CreateFieldApiParams } from './field-api.js';

// Pipeline (SE4.4)
export { executePipeline, type PipelineContext, type PipelineResult } from './pipeline.js';

// Expression integration (SE3.5)
export { applyRuleWrites } from './expression-integration.js';

// Arbiter integration (ADR arbiter §9)
export { createArbiterAdapter, createArbiterAdapterFromSession, type ArbiterFormAdapter } from './arbiter-integration.js';

// Equality utility
export { structuredEqual } from './equality.js';

// Trigger filter
export { shouldShowIssues, type TriggerContext } from './trigger-filter.js';

// Field meta shifting
export { shiftFieldMeta, clearChildFieldMeta, swapFieldMeta } from './field-meta-shift.js';

// Listener registry
export { createListenerRegistry, type ListenerEntry } from './listener-registry.js';

// Async validation
export { createAsyncValidationManager, type AsyncValidationManager, type AsyncManagerDeps } from './async-validation.js';

// Nested utilities (extracted from old rule engine)
export { setNestedValue, deleteNestedValue } from './nested-utils.js';

// Validation envelope (SE4.2)
export { sortIssues, dedupeIssues, normalizeIssues } from './validation.js';

// Transforms (SE6.1)
export {
  runTransforms,
  createDateTransform,
  createDateEgressTransform,
  createConfigurableDateEgressTransform,
  type TransformDefinition,
  type TransformPhase,
  type TransformContext,
  type DateEgressFormat,
  type DateEgressOptions,
} from './transforms.js';

// Timeout utilities (SE6.3)
export {
  withTimeout,
  DEFAULT_RUNTIME_CONSTRAINTS,
  type RuntimeConstraints,
} from './timeout.js';

// Type utilities (formr-typed-dx)
export type { DeepKeys, DeepValue, ArrayElement } from './type-utils.js';

// Middleware runner (SE6.2)
export {
  runVetoHooksSync,
  runNotifyHooksSync,
  runVetoHooksAsync,
  runNotifyHooksAsync,
  initMiddlewares,
  disposeMiddlewares,
} from './middleware-runner.js';
