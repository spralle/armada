export type {
  IntentActionMatch,
  IntentActionTrace,
  IntentResolution,
  IntentResolutionDelegate,
  IntentResolutionOutcome,
  IntentResolutionTrace,
  IntentResolutionWithTrace,
  IntentRuntime,
  IntentRuntimeDeps,
  IntentRuntimeOptions,
  IntentSession,
  RuntimeActionDescriptor,
  ShellIntent,
} from "./intent-runtime.js";
export {
  createActionCatalogFromRegistrySnapshot,
  createIntentRuntime,
  resolveIntent,
  resolveIntentWithTrace,
} from "./intent-runtime.js";
export type {
  IntentFactBag,
  IntentWhenMatcher,
  PredicateEvaluationResult,
  PredicateFailureTrace,
} from "./matcher/contracts.js";
export { createDefaultIntentWhenMatcher } from "./matcher/default-when-matcher.js";
export { createPredicateWhenMatcher } from "./matcher/predicate-when-matcher.js";
