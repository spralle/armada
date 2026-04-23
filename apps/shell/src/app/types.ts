import type {
  PluginContract,
  PluginSelectionContribution,
  PluginServices,
} from "@ghost-shell/contracts";
import { createDragSessionBroker } from "../dnd-session-broker.js";
import type { ShellLayoutState } from "../layout.js";
import type {
  ShellContextStatePersistence,
  ShellKeybindingPersistence,
  ShellLayoutPersistence,
  ShellWorkspacePersistence,
} from "../persistence.js";
import type { ShellPluginRegistry } from "../plugin-registry.js";
import type { ThemeRegistry } from "../theme-registry.js";
import type {
  WindowBridge,
} from "../window-bridge.js";
import type {
  AsyncWindowBridge,
  AsyncWindowBridgeRejectReason,
} from "./async-bridge.js";
import type {
  ContextTabCloseability,
  DerivedLaneDefinition,
  IncomingTransferJournal,
  RevisionMeta,
  SelectionPropagationRule,
  ShellContextState,
} from "../context-state.js";
import type {
  IntentActionMatch,
  IntentRuntime,
  IntentResolutionTrace,
  IntentSession,
} from "@ghost-shell/intents";
import type { ActionSurface } from "../action-surface.js";
import type { KeybindingOverrideManager } from "../shell-runtime/keybinding-override-manager.js";
import type { ShellPartHostAdapter } from "./contracts.js";
import type { WorkspaceManagerState } from "../context-state/workspace-types.js";
import type { ShellTransportPath } from "./migration-flags.js";
import type {
  DndDiagnosticEnvelope,
  DndDiagnosticRuntime,
  DndDiagnosticPath,
} from "./dnd-diagnostics.js";
/** Stub for ConfigurationService (@weaver/config-types removed). */
interface ConfigurationService {
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown, layer?: string): void;
  [key: string]: unknown;
}
import type { PluginConfigSyncConfigurationService } from "../plugin-config-sync-controller.js";
import type { GhostApiFactoryDependencies } from "../plugin-api/ghost-api-factory.js";
import type { SyncStatusServiceDeps } from "../sync-status-service-registration.js";
import type { ContextServiceDeps } from "../context-service-registration.js";
import type { KeybindingServiceDeps } from "../keybinding-service-registration.js";
import type { PlacementStrategyRegistry } from "../context-state/placement-strategy/registry.js";
import type { PlacementConfig } from "../context-state/placement-strategy/types.js";
import type { ShellStateObserver } from "@ghost/router";

export interface ShellBootstrapState {
  mode: "inner-loop" | "integration";
  loadedPlugins: PluginContract[];
  registry: ShellPluginRegistry;
  themeRegistry?: ThemeRegistry | undefined;
  disposePluginConfigSync: (() => void) | null;
}

export interface ShellBootstrapOptions {
  tenantId: string;
  fetchManifest?: (manifestUrl: string) => Promise<unknown>;
  enableByDefault?: boolean;
  defaultThemeId?: string | undefined;
  configurationService?: (ConfigurationService & PluginConfigSyncConfigurationService) | undefined;
  /** Called after manifest registration and after each plugin activation completes. */
  onProgress?: (registry: ShellPluginRegistry) => void;
  /** Dependencies for constructing GhostApi instances during plugin activation. */
  apiDeps?: GhostApiFactoryDependencies | undefined;
  /** Dependencies for SyncStatusService — registered before plugin activation. */
  syncStatusDeps?: SyncStatusServiceDeps | undefined;
  /** Dependencies for ContextService — registered before plugin activation. */
  contextServiceDeps?: ContextServiceDeps | undefined;
  /** Dependencies for KeybindingService — registered before plugin activation. */
  keybindingServiceDeps?: KeybindingServiceDeps | undefined;
}

// ---------------------------------------------------------------------------
// Narrow capability interfaces — each captures a cohesive slice of runtime.
// Consumers should depend on the narrowest interface(s) they actually need.
// ---------------------------------------------------------------------------

export interface LayoutHost {
  layout: ShellLayoutState;
}

export interface StateHost {
  contextState: ShellContextState;
  workspaceManager: WorkspaceManagerState;
}

export interface BridgeHost {
  bridge: WindowBridge;
  asyncBridge: AsyncWindowBridge;
  windowId: string;
  syncDegraded: boolean;
  syncHealthState: "healthy" | "degraded" | "unavailable";
  syncDegradedReason: AsyncWindowBridgeRejectReason | null;
  pendingProbeId: string | null;
  activeTransportPath: ShellTransportPath;
  activeTransportReason: "kill-switch-force-legacy" | "async-flag-enabled" | "default-legacy";
}

export interface PluginHost {
  registry: ShellPluginRegistry;
  services: PluginServices;
  /** Shared registry of runtime action handlers registered by plugins via ActionService. */
  runtimeActionRegistry: Map<string, (...args: unknown[]) => unknown>;
}

export interface ThemeHost {
  themeRegistry: ThemeRegistry | null;
}

export interface CommandHost {
  actionSurface: ActionSurface;
  keybindingOverrideManager: KeybindingOverrideManager;
}

export interface IntentHost {
  intentRuntime: IntentRuntime;
  activeIntentSession: IntentSession | null;
  lastIntentTrace: IntentResolutionTrace | null;
  /** Resolver for the async chooser promise bridge. Set by showChooser delegate, consumed by UI handlers. */
  _pendingChooserResolve: ((match: IntentActionMatch | null) => void) | null;
}

export interface DndHost {
  dragSessionBroker: ReturnType<typeof createDragSessionBroker>;
  incomingTransferJournal: IncomingTransferJournal;
  sourceTabTransferPendingBySessionId?: Map<string, SourceTabTransferPendingState>;
  sourceTabTransferTerminalSessionIds?: Set<string>;
  crossWindowDndEnabled: boolean;
  crossWindowDndKillSwitchActive: boolean;
  activeDndPath: DndDiagnosticPath;
  activeDndReason: "kill-switch-force-disabled" | "flag-enabled" | "default-same-window-only";
}

export interface PersistenceHost {
  persistence: ShellLayoutPersistence;
  contextPersistence: ShellContextStatePersistence;
  keybindingPersistence: ShellKeybindingPersistence;
  workspacePersistence: ShellWorkspacePersistence;
}

export interface PopoutHost {
  hostWindowId: string | null;
  popoutTabId: string | null;
  isPopout: boolean;
  popoutHandles: Map<string, Window>;
  poppedOutTabIds: Set<string>;
}

// ---------------------------------------------------------------------------
// ShellRuntime — the full god-object, composed from all capability interfaces.
// Composition root and top-level wiring keep this type; leaf consumers should
// migrate to the narrowest host interface(s) they need (armada-mi6h).
// ---------------------------------------------------------------------------

export interface ShellRuntime extends
  DndDiagnosticRuntime,
  LayoutHost,
  StateHost,
  BridgeHost,
  PluginHost,
  ThemeHost,
  CommandHost,
  IntentHost,
  DndHost,
  PersistenceHost,
  PopoutHost {
  selectedPartId: string | null;
  selectedPartTitle: string | null;
  notice: string;
  pluginNotice: string;
  intentNotice: string;
  closeableTabIds: Set<string>;
  announcement: string;
  pendingFocusSelector: string | null;
  workspaceEvents: {
    fireDidChangeWorkspaces(): void;
    readonly onDidChangeWorkspaces: import("@ghost-shell/contracts").Event<void>;
  };
  commandNotice: string;
  partHost: ShellPartHostAdapter;
  pluginConfigSyncDispose: (() => void) | null;
  registrySubscriptionDispose: (() => void) | null;
  lastDndDiagnostic: DndDiagnosticEnvelope | null;
  placementRegistry: PlacementStrategyRegistry;
  placementConfig: PlacementConfig;
  stateObserver?: ShellStateObserver | undefined;
  elevatedSession: {
    active: boolean;
    activatedAt: number | null;
  };
}

export interface SourceTabTransferPendingState {
  sessionId: string;
  tabId: string;
  restoreActiveTabId: string | null;
  restoreSelectedPartId: string | null;
  restoreSelectedPartTitle: string | null;
  timeoutAt: number;
}

export interface TenantPluginDescriptor {
  id: string;
  version: string;
  entry: string;
  compatibility: {
    shell: string;
    pluginContract: string;
  };
  pluginDependencies?: string[];
}

export interface TenantPluginManifestResponse {
  tenantId: string;
  plugins: TenantPluginDescriptor[];
}

export interface RuntimeDerivedLaneContribution {
  id: string;
  key: string;
  sourceEntityType: string;
  scope: "global" | "group";
  valueType: string;
  strategy: "priority-id" | "joined-selected-ids";
}

export interface SelectionGraphExtensions {
  propagationRules: SelectionPropagationRule[];
  derivedLanes: DerivedLaneDefinition[];
}

export interface SelectionPropagationResult {
  state: ShellContextState;
  derivedLaneFailures: string[];
}

export type SelectionWrite = {
  entityType: string;
  selectedIds: string[];
  priorityId: string | null;
};

export type DevLaneMetadata = {
  scope: string;
  key: string;
  value: string;
  revision: RevisionMeta;
  sourceSelection: { entityType: string; revision: RevisionMeta } | undefined;
};

export type RenderTabMetadata = {
  tabId: string;
  groupId: string;
  label: string;
  isActive: boolean;
  closeability: ContextTabCloseability;
};

export type PluginSelectionContrib = PluginSelectionContribution;
