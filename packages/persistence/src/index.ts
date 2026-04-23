export type {
  ContextStateLoadResult,
  ContextStateSaveResult,
  ContextStatePersistenceOptions,
  ContextStateEnvelopeV2,
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
  SHELL_PERSISTENCE_STORAGE_KEY,
  SHELL_PERSISTENCE_SCHEMA_VERSION,
  LAYOUT_SECTION_SCHEMA_VERSION,
  CONTEXT_STATE_SCHEMA_VERSION,
  WORKSPACE_SCHEMA_VERSION,
  KEYBINDING_OVERRIDES_SCHEMA_VERSION,
  getUnifiedStorageKey,
  safeParseUnknown,
  loadUnifiedEnvelope,
  migrateUnifiedShellEnvelope,
  migrateLayoutSectionEnvelope,
  migrateContextStateEnvelope,
  migrateKeybindingOverridesEnvelope,
  migrateWorkspacePersistenceEnvelope,
} from "./envelope.js";

export { isRecord } from "./utils.js";

export {
  sanitizeDockTreeState,
  sanitizeDockTreeStateWithReport,
  type DockTreeSanitizeResult,
} from "./sanitize-dock-tree.js";

export {
  sanitizeContextState,
  sanitizeWorkspaceEnvelope,
} from "./sanitize.js";

export {
  createLocalStorageContextStatePersistence,
  createLocalStorageWorkspacePersistence,
} from "./context-persistence.js";

export {
  createLocalStorageKeybindingPersistence,
} from "./keybinding-persistence.js";

export {
  createLocalStorageLayoutPersistence,
} from "./layout-persistence.js";

export {
  CONTEXT_STATE_CONFIG_KEY,
  contextStateConfigSchema,
  createContextConfigBridge,
  createConfigBackedContextPersistence,
  type ContextConfigBridge,
  type ContextConfigBridgeOptions,
} from "./context-config-bridge.js";

export {
  KEYBINDING_CONFIG_KEY,
  keybindingConfigSchema,
  createKeybindingConfigBridge,
  createConfigBackedKeybindingPersistence,
  type KeybindingConfigBridge,
  type KeybindingConfigBridgeOptions,
} from "./keybinding-config-bridge.js";

export {
  LAYOUT_CONFIG_KEY,
  layoutConfigSchema,
  createLayoutConfigBridge,
  createConfigBackedLayoutPersistence,
  type LayoutConfigBridge,
  type LayoutConfigBridgeOptions,
} from "./layout-config-bridge.js";
