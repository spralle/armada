export type { ResolveMountOptions } from "@ghost-shell/contracts/parts";
// Re-export resolve-mount utilities — canonical import path for runtime mount resolution
export { resolveModuleMountFn } from "@ghost-shell/contracts/parts";
export type {
  CapabilityDependencyFailure,
  CapabilityDependencyFailureCode,
  CapabilityRegistry,
  CapabilityResolutionContext,
  PluginComponentsModule,
  PluginDependencyValidationContext,
  PluginServicesModule,
} from "./capability-registry.js";
export {
  createCapabilityRegistry,
  pickComponentModuleExport,
  pickServiceModuleExport,
} from "./capability-registry.js";

export type {
  CompatibilityReasonCode,
  ShellPluginCompatibilityResult,
} from "./compatibility.js";

export { evaluateShellPluginCompatibility } from "./compatibility.js";
export type {
  ComposedPluginContributions,
  ComposedPluginLayerSurfaceContribution,
  ComposedPluginPartContribution,
  ComposedPluginSectionContribution,
  ComposedPluginSlotContribution,
  ComposedPluginViewContribution,
  ComposedThemeContribution,
  PluginContributionSource,
} from "./composition.js";
export {
  composeEnabledPluginContributions,
  composeThemeContributions,
} from "./composition.js";
export { createContextContributionRegistry } from "./context-contribution-registry.js";
export { createEventEmitter } from "./event-emitter.js";
export {
  readCapabilityComponents,
  readCapabilityServices,
} from "./plugin-registry-contract.js";
export type {
  ContributionPredicateMatcher,
  PredicateEvaluationResult,
  PredicateFactBag,
  PredicateFailureTrace,
} from "./predicate.js";
export {
  createDefaultContributionPredicateMatcher,
  evaluateContributionPredicate,
} from "./predicate.js";
export { createVanillaDomRenderer } from "./vanilla-dom-renderer.js";
