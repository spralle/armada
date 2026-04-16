export type { Disposable } from "./disposable.js";

export type { Event, EventEmitter } from "./event.js";
export { createEventEmitter } from "./event.js";

export type {
  PluginGalleryBanner,
  PluginGallery,
  PluginManifestIdentity,
  PluginViewContribution,
  PluginPartContribution,
  PluginDockableTabMetadata,
  PluginCapabilityComponentContribution,
  PluginCapabilityServiceContribution,
  PluginDependencyPluginRequirement,
  PluginDependencyComponentRequirement,
  PluginDependencyServiceRequirement,
  PluginProvidedCapabilities,
  PluginDependencies,
  PluginContributionPredicate,
  PluginActionContribution,
  PluginMenuContribution,
  PluginKeybindingContribution,
  PluginSelectionContribution,
  PluginSelectionInterest,
  PluginDerivedLaneContribution,
  PluginDragDropSessionReference,
  PluginPopoutCapabilityFlags,
  ThemeBackgroundEntry,
  ThemeFonts,
  ThemeContribution,
  BrandingLogo,
  BrandingLoadingScreen,
  BrandingContribution,
  PluginConfigurationContribution,
  ShellEdgeSlot,
  ShellEdgeSlotPosition,
  PluginSlotContribution,
  PluginContributions,
  PluginContract,
  PluginCompatibilityMetadata,
  TenantPluginDescriptor,
  TenantPluginManifestResponse,
} from "./types.js";

export {
  pluginManifestIdentitySchema,
  pluginGalleryBannerSchema,
  pluginGallerySchema,
  pluginViewContributionSchema,
  pluginPartContributionSchema,
  pluginCapabilityComponentContributionSchema,
  pluginCapabilityServiceContributionSchema,
  pluginProvidedCapabilitiesSchema,
  pluginDependencyPluginRequirementSchema,
  pluginDependencyComponentRequirementSchema,
  pluginDependencyServiceRequirementSchema,
  pluginDependenciesSchema,
  pluginActionContributionSchema,
  pluginMenuContributionSchema,
  pluginKeybindingContributionSchema,
  pluginSelectionContributionSchema,
  pluginDerivedLaneContributionSchema,
  pluginDragDropSessionReferenceSchema,
  pluginPopoutCapabilityFlagsSchema,
  shellEdgeSlotSchema,
  shellEdgeSlotPositionSchema,
  pluginSlotContributionSchema,
  pluginContributionsSchema,
  pluginConfigurationContributionSchema,
  pluginContractSchema,
  pluginCompatibilityMetadataSchema,
  tenantPluginDescriptorSchema,
  tenantPluginManifestResponseSchema,
  themeContributionSchema,
  brandingContributionSchema,
  activationEventsSchema,
} from "./schemas.js";

export type {
  ComposedPluginViewContribution,
  ComposedPluginPartContribution,
  ComposedPluginSlotContribution,
  ComposedPluginContributions,
  ComposedThemeContribution,
  PluginContributionSource,
} from "./composition.js";

export {
  composeEnabledPluginContributions,
  composeThemeContributions,
} from "./composition.js";

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

export type {
  GhostApi,
  ActionService,
  ActionDescriptor,
  WindowService,
  WindowDescriptor,
  QuickPickItem,
  QuickPickOptions,
  QuickPick,
  InputBoxOptions,
  ActivationContext,
} from "./ghost-api.js";

export type {
  ThemeMode,
  TerminalPalette,
  PartialThemePalette,
  FullThemePalette,
} from "./theme-derivation.js";

export {
  partialThemePaletteSchema,
  terminalPaletteSchema,
  deriveFullPalette,
} from "./theme-derivation.js";

export { GHOST_THEME_CSS_VARS } from "./theme-css-vars.js";

export {
  adjustLightness,
  desaturate,
  contrastSafe,
  blendWithBackground,
  contrastRatio,
  relativeLuminance,
  isValidHex,
  withAlpha,
} from "./theme-color-utils.js";

export type { ThemeService, ThemeInfo, BackgroundInfo } from "./theme-service.js";
export { THEME_SERVICE_ID } from "./theme-service.js";

export type { PluginServices, PluginMountContext } from "./plugin-services.js";

export { CONFIG_SERVICE_ID } from "./config-service.js";
