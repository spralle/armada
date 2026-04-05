export type {
  PluginManifestIdentity,
  PluginViewContribution,
  PluginPartContribution,
  PluginContributionPredicate,
  PluginActionContribution,
  PluginMenuContribution,
  PluginKeybindingContribution,
  PluginSelectionContribution,
  PluginSelectionInterest,
  PluginDerivedLaneContribution,
  PluginDragDropSessionReference,
  PluginPopoutCapabilityFlags,
  PluginContributions,
  PluginContract,
  PluginCompatibilityMetadata,
  TenantPluginDescriptor,
  TenantPluginManifestResponse,
} from "./types.js";

export {
  pluginManifestIdentitySchema,
  pluginViewContributionSchema,
  pluginPartContributionSchema,
  pluginActionContributionSchema,
  pluginMenuContributionSchema,
  pluginKeybindingContributionSchema,
  pluginSelectionContributionSchema,
  pluginDerivedLaneContributionSchema,
  pluginDragDropSessionReferenceSchema,
  pluginPopoutCapabilityFlagsSchema,
  pluginContributionsSchema,
  pluginContractSchema,
  pluginCompatibilityMetadataSchema,
  tenantPluginDescriptorSchema,
  tenantPluginManifestResponseSchema,
} from "./schemas.js";

export type {
  ComposedPluginViewContribution,
  ComposedPluginPartContribution,
  ComposedPluginContributions,
  PluginContributionSource,
} from "./composition.js";

export { composeEnabledPluginContributions } from "./composition.js";

export type {
  PluginContractValidationIssue,
  ParsePluginContractResult,
  ParseTenantPluginManifestResult,
} from "./parsing.js";

export { parsePluginContract, parseTenantPluginManifest } from "./parsing.js";

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
