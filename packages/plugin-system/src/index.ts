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

export type {
  CapabilityDependencyFailureCode,
  CapabilityDependencyFailure,
  PluginDependencyValidationContext,
  CapabilityResolutionContext,
  CapabilityRegistry,
  PluginComponentsModule,
  PluginServicesModule,
} from "./capability-registry.js";

export {
  createCapabilityRegistry,
  pickComponentModuleExport,
  pickServiceModuleExport,
} from "./capability-registry.js";

export {
  readCapabilityComponents,
  readCapabilityServices,
} from "./plugin-registry-contract.js";

export { createContextContributionRegistry } from "./context-contribution-registry.js";

export { createEventEmitter } from "./event-emitter.js";

export { createVanillaDomRenderer } from "./vanilla-dom-renderer.js";

// Re-export resolve-mount utilities — canonical import path for runtime mount resolution
export { resolveModuleMountFn } from "@ghost-shell/contracts/parts";
export type { ResolveMountOptions } from "@ghost-shell/contracts/parts";
