import type { PluginActivationTriggerType } from "../plugin-registry.js";
import type { ShellRuntime } from "./types.js";
import type { ComposedShellPart } from "../ui/parts-rendering.js";
import type {
  ContextSyncEvent,
  SelectionSyncEvent,
  WindowBridgeEvent,
} from "../window-bridge.js";
import type {
  IntentActionMatch,
  IntentResolutionTrace,
  IntentSession,
  ShellIntent,
} from "../intent-runtime.js";
import type { DevLaneMetadata, RenderTabMetadata } from "./types.js";

export interface ShellCoreSnapshot {
  activeTabId: string | null;
  selectedPartId: string | null;
  selectedPartTitle: string | null;
  notice: string;
  pluginNotice: string;
  intentNotice: string;
  commandNotice: string;
  activeIntentSession: IntentSession | null;
  lastIntentTrace: IntentResolutionTrace | null;
  tabMetadata: RenderTabMetadata[];
  laneMetadata: DevLaneMetadata[];
}

/**
 * Shell core boundary invariants:
 * - Core orchestration modules must not directly import DOM, React, or federation runtime internals.
 * - Side effects must be routed through ShellEffectsPort.
 * - Renderer and part-host adapters should remain thin compatibility layers.
 */

export interface ShellCoreApi {
  applyContext(event: ContextSyncEvent): void;
  applySelection(event: SelectionSyncEvent): void;
  resolveIntentFlow(intent: ShellIntent): void;
  executeResolvedAction(match: IntentActionMatch, intent: ShellIntent | null): Promise<void>;
  getSnapshot(): ShellCoreSnapshot;
  subscribe(listener: (snapshot: ShellCoreSnapshot) => void): () => void;
}

export interface ShellEffectsPort {
  activatePluginForBoundary(options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  }): Promise<boolean>;
  announce(message: string): void;
  publishWithDegrade(event: WindowBridgeEvent): void;
  renderContextControlsPanel(): void;
  renderParts(): void;
  renderSyncStatus(): void;
  summarizeSelectionPriorities(): string;
}

export interface ShellRendererAdapter {
  initialize(root: HTMLElement, runtime: ShellRuntime, effects: ShellEffectsPort): void;
  mountMainWindow(root: HTMLElement, deps: {
    renderParts: () => void;
    updateWindowReadOnlyState: () => void;
    setupResize: () => () => void;
    publishRestoreRequestOnUnload: () => void;
  }): () => void;
  mountPopout(root: HTMLElement, runtime: ShellRuntime, deps: {
    renderParts: () => void;
    updateWindowReadOnlyState: () => void;
    setupResize: () => () => void;
    publishRestoreRequestOnUnload: () => void;
  }): () => void;
  renderPanels(root: HTMLElement, runtime: ShellRuntime): void;
  renderContextControlsPanel(root: HTMLElement, runtime: ShellRuntime): void;
  renderParts(root: HTMLElement, runtime: ShellRuntime): void;
  renderSyncStatus(root: HTMLElement, runtime: ShellRuntime): void;
  renderEdgeSlots(root: HTMLElement, runtime: ShellRuntime): void;
  renderLayerSurfaces(root: HTMLElement, runtime: ShellRuntime): void;
}

export interface ShellPartHostAdapter {
  syncRenderedParts(root: HTMLElement, parts: ComposedShellPart[]): Promise<void>;
  unmountAll(): void;
}
