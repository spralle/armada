export type { Disposable } from "./disposable.js";

export {
  AnchorEdge,
  KeyboardInteractivity,
  InputBehavior,
} from "./layer-types.js";

export type {
  LayerDefinition,
  FocusGrabConfig,
  AutoStackConfig,
  PluginLayerSurfaceContribution,
  PluginLayerDefinition,
  LayerSurfaceContext,
} from "./layer-types.js";

export type { Event, EventEmitter } from "./event.js";
export { createEventEmitter } from "./event.js";

export type {
  ConfigurationPropertySchema,
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
  pluginLayerSurfaceContributionSchema,
  pluginLayerDefinitionSchema,
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
  ViewService,
  ViewDescriptor,
  OpenViewOptions,
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

export { GHOST_THEME_CSS_VARS, THEME_TOKEN_GROUPS } from "./theme-css-vars.js";

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

export {
  INTENT_ENTITY_OPEN,
  INTENT_ENTITY_INSPECT,
  INTENT_ENTITY_ASSIGN,
} from "./domain-intents.js";

export type {
  PluginRegistryService,
  PluginRegistryEntry,
  PluginRegistryServiceSnapshot,
  ContributionItem,
  ThemeContributionItem,
  KeybindingContributionItem,
  SlotContributionItem,
  CapabilityContributionItem,
  PluginContributionsSummary,
  PluginFailureInfo,
  PluginLifecycleInfo,
  PluginDependencySummary,
  PluginReverseDependency,
  PluginRegistryDiagnosticEntry,
} from "./plugin-registry-service.js";
export { PLUGIN_REGISTRY_SERVICE_ID } from "./plugin-registry-service.js";

export type { PluginManagementService } from "./plugin-management-service.js";
export { PLUGIN_MANAGEMENT_SERVICE_ID } from "./plugin-management-service.js";

export type { SyncStatusService } from "./sync-status-service.js";
export { SYNC_STATUS_SERVICE_ID } from "./sync-status-service.js";

export type { ActivityToken, ActivityStatusService } from "./activity-status-service.js";
export { ACTIVITY_STATUS_SERVICE_ID } from "./activity-status-service.js";

export type { ContextService } from "./context-service.js";
export { CONTEXT_SERVICE_ID } from "./context-service.js";

export type { WorkspaceService, WorkspaceInfo } from "./workspace-service.js";
export { WORKSPACE_SERVICE_ID } from "./workspace-service.js";

export type {
  KeybindingService,
  KeybindingEntry,
  KeybindingOverride,
  KeySequencePendingEvent,
  KeySequenceCompletedEvent,
  KeySequenceCancelledEvent,
} from "./keybinding-service.js";
export { KEYBINDING_SERVICE_ID } from "./keybinding-service.js";

export { MF_SHARED_SINGLETONS } from "./shared-dependencies.js";
export type { MfSharedSingleton } from "./shared-dependencies.js";
