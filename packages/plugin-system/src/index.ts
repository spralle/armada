export type {
  ComposedPluginViewContribution,
  ComposedPluginPartContribution,
  ComposedPluginSlotContribution,
  ComposedPluginSectionContribution,
  ComposedPluginLayerSurfaceContribution,
  ComposedPluginContributions,
  ComposedThemeContribution,
  PluginContributionSource,
} from "./composition.js";

export {
  composeEnabledPluginContributions,
  composeThemeContributions,
} from "./composition.js";

export type {
  PredicateFactBag,
  PredicateFailureTrace,
  PredicateEvaluationResult,
  ContributionPredicateMatcher,
} from "./predicate.js";

export {
  createDefaultContributionPredicateMatcher,
  evaluateContributionPredicate,
} from "./predicate.js";

export type {
  CompatibilityReasonCode,
  ShellPluginCompatibilityResult,
} from "./compatibility.js";

export { evaluateShellPluginCompatibility } from "./compatibility.js";
