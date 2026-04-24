export type {
  IntentFactBag,
  IntentWhenMatcher,
  PredicateFailureTrace,
  PredicateEvaluationResult,
} from "./matcher/contracts.js";

export { createPredicateWhenMatcher } from "./matcher/predicate-when-matcher.js";
export { createDefaultIntentWhenMatcher } from "./matcher/default-when-matcher.js";

export {
  createIntentRuntime,
  resolveIntent,
  resolveIntentWithTrace,
  createActionCatalogFromRegistrySnapshot,
} from "./intent-runtime.js";

export type {
  ShellIntent,
  RuntimeActionDescriptor,
  IntentActionMatch,
  IntentSession,
  IntentActionTrace,
  IntentResolutionTrace,
  IntentResolutionWithTrace,
  IntentRuntime,
  IntentRuntimeDeps,
  IntentRuntimeOptions,
  IntentResolutionDelegate,
  IntentResolutionOutcome,
  IntentResolution,
} from "./intent-runtime.js";
