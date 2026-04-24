export type { ThemeService, ThemeInfo, BackgroundInfo } from "./theme-service.js";
export { THEME_SERVICE_ID } from "./theme-service.js";

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

export type { ActivityToken, ActivityStatusService } from "./activity-status-service.js";
export { ACTIVITY_STATUS_SERVICE_ID } from "./activity-status-service.js";

export type { SyncStatusService } from "./sync-status-service.js";
export { SYNC_STATUS_SERVICE_ID } from "./sync-status-service.js";

export type { ContextService } from "./context-service.js";
export { CONTEXT_SERVICE_ID } from "./context-service.js";

export { CONFIG_SERVICE_ID } from "./config-service.js";

export type { HookService, TransitionContext, ElementTransitionHook } from "./hooks.js";
export { HOOK_REGISTRY_SERVICE_ID, ELEMENT_TRANSITION_HOOK_ID } from "./hooks.js";
