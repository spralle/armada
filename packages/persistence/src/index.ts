export {
  CONTEXT_STATE_CONFIG_KEY,
  type ContextConfigBridge,
  type ContextConfigBridgeOptions,
  contextStateConfigSchema,
  createConfigBackedContextPersistence,
  createContextConfigBridge,
} from "./context-config-bridge.js";
export {
  createLocalStorageContextStatePersistence,
  createLocalStorageWorkspacePersistence,
} from "./context-persistence.js";
export type {
  ContextStateEnvelopeV2,
  ContextStateLoadResult,
  ContextStatePersistenceOptions,
  ContextStateSaveResult,
  KeybindingOverrideEntryV1,
  KeybindingOverridesEnvelopeV1,
  KeybindingPersistenceOptions,
  LayoutEnvelopeV1,
  LayoutPersistenceOptions,
  PersistedWorkspace,
  ShellContextStatePersistence,
  ShellKeybindingPersistence,
  ShellLayoutPersistence,
  ShellWorkspacePersistence,
  StorageLike,
  UnifiedShellPersistenceEnvelopeV1,
  WorkspaceManagerLoadResult,
  WorkspaceManagerSaveResult,
  WorkspacePersistenceEnvelopeV1,
} from "./contracts.js";
export {
  CONTEXT_STATE_SCHEMA_VERSION,
  getUnifiedStorageKey,
  KEYBINDING_OVERRIDES_SCHEMA_VERSION,
  LAYOUT_SECTION_SCHEMA_VERSION,
  loadUnifiedEnvelope,
  mergeAndSaveEnvelope,
  migrateContextStateEnvelope,
  migrateKeybindingOverridesEnvelope,
  migrateLayoutSectionEnvelope,
  migrateUnifiedShellEnvelope,
  migrateWorkspacePersistenceEnvelope,
  SHELL_PERSISTENCE_SCHEMA_VERSION,
  SHELL_PERSISTENCE_STORAGE_KEY,
  safeParseUnknown,
  WORKSPACE_SCHEMA_VERSION,
} from "./envelope.js";
export {
  createConfigBackedKeybindingPersistence,
  createKeybindingConfigBridge,
  KEYBINDING_CONFIG_KEY,
  type KeybindingConfigBridge,
  type KeybindingConfigBridgeOptions,
  keybindingConfigSchema,
} from "./keybinding-config-bridge.js";
export { createLocalStorageKeybindingPersistence } from "./keybinding-persistence.js";
export {
  createConfigBackedLayoutPersistence,
  createLayoutConfigBridge,
  LAYOUT_CONFIG_KEY,
  type LayoutConfigBridge,
  type LayoutConfigBridgeOptions,
  layoutConfigSchema,
} from "./layout-config-bridge.js";

export { createLocalStorageLayoutPersistence } from "./layout-persistence.js";
export {
  sanitizeContextState,
  sanitizeWorkspaceEnvelope,
} from "./sanitize.js";
export {
  type DockTreeSanitizeResult,
  sanitizeDockTreeState,
  sanitizeDockTreeStateWithReport,
} from "./sanitize-dock-tree.js";
export { isRecord } from "./utils.js";
