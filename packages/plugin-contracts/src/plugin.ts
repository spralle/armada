export type { Disposable } from "./disposable.js";
export type { Event, EventEmitter } from "./event.js";

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
  PluginSectionContribution,
  PluginContributions,
  PluginContract,
  PluginCompatibilityMetadata,
  TenantPluginDescriptor,
  TenantPluginManifestResponse,
} from "./types.js";

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
  DeactivationContext,
  ViewService,
  ViewDescriptor,
  OpenViewOptions,
} from "./ghost-api.js";

export type { PluginServices, PluginMountContext, PartMountCleanup, MountPartFn } from "./plugin-services.js";

export {
  INTENT_ENTITY_OPEN,
  INTENT_ENTITY_INSPECT,
  INTENT_ENTITY_ASSIGN,
} from "./domain-intents.js";

export { definePlugin } from "./define-plugin.js";
export type { ExtractPartIds, ExtractActionIds } from "./define-plugin.js";
