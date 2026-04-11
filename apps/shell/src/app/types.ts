import type {
  PluginContract,
  PluginSelectionContribution,
} from "@ghost/plugin-contracts";
import { createDragSessionBroker } from "../dnd-session-broker.js";
import type { ShellLayoutState } from "../layout.js";
import type {
  ShellContextStatePersistence,
  ShellLayoutPersistence,
} from "../persistence.js";
import type { ShellPluginRegistry } from "../plugin-registry.js";
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
  ShellIntent,
} from "../intent-runtime.js";
import type { ActionSurface } from "../action-surface.js";
import type { ShellPartHostAdapter } from "./contracts.js";
import type { ShellTransportPath } from "./migration-flags.js";
import type {
  DndDiagnosticEnvelope,
  DndDiagnosticRuntime,
  DndDiagnosticPath,
} from "./dnd-diagnostics.js";

export interface ShellBootstrapState {
  mode: "inner-loop" | "integration";
  loadedPlugins: PluginContract[];
  registry: ShellPluginRegistry;
}

export interface ShellBootstrapOptions {
  tenantId: string;
  fetchManifest?: (manifestUrl: string) => Promise<unknown>;
  enableByDefault?: boolean;
}

export interface ShellRuntime extends DndDiagnosticRuntime {
  layout: ShellLayoutState;
  persistence: ShellLayoutPersistence;
  contextPersistence: ShellContextStatePersistence;
  registry: ShellPluginRegistry;
  bridge: WindowBridge;
  asyncBridge: AsyncWindowBridge;
  windowId: string;
  hostWindowId: string | null;
  popoutTabId: string | null;
  isPopout: boolean;
  selectedPartId: string | null;
  selectedPartTitle: string | null;
  contextState: ShellContextState;
  notice: string;
  pluginNotice: string;
  intentNotice: string;
  pendingIntentMatches: IntentActionMatch[];
  pendingIntent: ShellIntent | null;
  lastIntentTrace: IntentResolutionTrace | null;
  popoutHandles: Map<string, Window>;
  poppedOutTabIds: Set<string>;
  closeableTabIds: Set<string>;
  dragSessionBroker: ReturnType<typeof createDragSessionBroker>;
  incomingTransferJournal: IncomingTransferJournal;
  sourceTabTransferPendingBySessionId?: Map<string, SourceTabTransferPendingState>;
  sourceTabTransferTerminalSessionIds?: Set<string>;
  crossWindowDndEnabled: boolean;
  crossWindowDndKillSwitchActive: boolean;
  syncDegraded: boolean;
  syncHealthState: "healthy" | "degraded" | "unavailable";
  syncDegradedReason: AsyncWindowBridgeRejectReason | null;
  pendingProbeId: string | null;
  announcement: string;
  chooserFocusIndex: number;
  pendingFocusSelector: string | null;
  chooserReturnFocusSelector: string | null;
  actionSurface: ActionSurface;
  intentRuntime: IntentRuntime;
  commandNotice: string;
  partHost: ShellPartHostAdapter;
  activeTransportPath: ShellTransportPath;
  activeTransportReason: "kill-switch-force-legacy" | "async-flag-enabled" | "default-legacy";
  activeDndPath: DndDiagnosticPath;
  activeDndReason: "kill-switch-force-disabled" | "flag-enabled" | "default-same-window-only";
  lastDndDiagnostic: DndDiagnosticEnvelope | null;
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
