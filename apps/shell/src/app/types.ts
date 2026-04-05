import type {
  PluginContract,
  PluginSelectionContribution,
} from "@armada/plugin-contracts";
import { createDragSessionBroker } from "../dnd-session-broker.js";
import type { ShellLayoutState } from "../layout.js";
import type {
  ShellContextStatePersistence,
  ShellLayoutPersistence,
} from "../persistence.js";
import type { ShellPluginRegistry } from "../plugin-registry.js";
import type {
  WindowBridge,
  WindowBridgeHealth,
} from "../window-bridge.js";
import type {
  DerivedLaneDefinition,
  RevisionMeta,
  SelectionPropagationRule,
  ShellContextState,
} from "../context-state.js";
import type {
  IntentActionMatch,
  IntentResolutionTrace,
  ShellIntent,
} from "../intent-runtime.js";

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

export interface ShellRuntime {
  layout: ShellLayoutState;
  persistence: ShellLayoutPersistence;
  contextPersistence: ShellContextStatePersistence;
  registry: ShellPluginRegistry;
  bridge: WindowBridge;
  windowId: string;
  hostWindowId: string | null;
  partId: string | null;
  isPopout: boolean;
  selectedPartId: string | null;
  selectedPartTitle: string | null;
  selectedOrderId: string | null;
  selectedVesselId: string | null;
  contextState: ShellContextState;
  notice: string;
  pluginNotice: string;
  intentNotice: string;
  pendingIntentMatches: IntentActionMatch[];
  pendingIntent: ShellIntent | null;
  lastIntentTrace: IntentResolutionTrace | null;
  popoutHandles: Map<string, Window>;
  poppedOutPartIds: Set<string>;
  dragSessionBroker: ReturnType<typeof createDragSessionBroker>;
  syncDegraded: boolean;
  syncDegradedReason: WindowBridgeHealth["reason"];
  pendingProbeId: string | null;
  announcement: string;
  chooserFocusIndex: number;
  pendingFocusSelector: string | null;
  chooserReturnFocusSelector: string | null;
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

export type PluginSelectionContrib = PluginSelectionContribution;
