// Path system (SE1.1)
export { type Namespace, type CanonicalSegment, type CanonicalPath } from './path.js';
export { parsePath, toPointer, toDot } from './path-parser.js';
export { FormrError, type FormrErrorCode } from './errors.js';

// State types (SE1.2)
export {
  type IssueSeverity,
  type SubmitMode,
  type ValidationIssue,
  type SubmitContext,
  type FormState,
  type StagePolicy,
  type StageTransitionRule,
  type CreateFormOptions,
} from './state.js';

// Contract types (SE1.2)
export {
  type ValidatorAdapter,
  type ExprNode,
  type ExpressionDefinition,
  type RuleDefinition,
  type RuleWrite,
  type RuleWriteIntent,
  type ExpressionScope,
  type ExpressionEngine,
  type Middleware,
  type Transform,
  type SubmitExecutionContext,
  type SubmitResult,
  type FormAction,
  type FormDispatchResult,
  type FieldConfig,
  type FieldApi,
  type FormApi,
} from './contracts.js';

// Stage policy (SE4.1)
export { createDefaultStagePolicy, createStagePolicy, assertKnownStage, type DefaultStages } from './stage-policy.js';
export { resolveActiveStage, applySubmitOutcome } from './submit.js';

// Transaction model (SE1.3)
export { Transaction, type TransactionSnapshot } from './transaction.js';
export { FormStore, type StateListener } from './store.js';
export { deepFreeze } from './utils.js';

// Form factory (SE1.4)
export { createForm } from './create-form.js';
export { createFieldApi, type CreateFieldApiParams } from './field-api.js';

// Expression integration (SE3.5)
export { buildExpressionScope, evaluateExpressions, applyRuleWrites } from './expression-integration.js';

// Validation envelope (SE4.2)
export { sortIssues, dedupeIssues, normalizeIssues } from './validation.js';

// Transforms (SE6.1)
export {
  runTransforms,
  createDateTransform,
  createDateEgressTransform,
  type TransformDefinition,
  type TransformPhase,
  type TransformContext,
} from './transforms.js';

// Extensions (SE6.3)
export {
  validateExtension,
  isCompatibleVersion,
  withTimeout,
  STABLE_CAPABILITIES,
  EXPERIMENTAL_CAPABILITIES,
  DEFAULT_RUNTIME_CONSTRAINTS,
  type ExtensionManifest,
  type RuntimeConstraints,
} from './extensions.js';
