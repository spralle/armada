import type { ComposedShellPart } from "../ui/parts-rendering.js";
import type {
  ContextSyncEvent,
  SelectionSyncEvent,
} from "@ghost-shell/bridge";
import type {
  IntentActionMatch,
  IntentResolutionTrace,
  IntentSession,
  ShellIntent,
} from "@ghost-shell/intents";
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
 * - Side effects must be routed through the bootstrap shell effects wiring.
 * - Part-host adapters should remain thin compatibility layers.
 */

export interface ShellCoreApi {
  applyContext(event: ContextSyncEvent): void;
  applySelection(event: SelectionSyncEvent): void;
  resolveIntentFlow(intent: ShellIntent): void;
  executeResolvedAction(match: IntentActionMatch, intent: ShellIntent | null): Promise<void>;
  getSnapshot(): ShellCoreSnapshot;
  subscribe(listener: (snapshot: ShellCoreSnapshot) => void): () => void;
}

export interface ShellPartHostAdapter {
  syncRenderedParts(root: HTMLElement, parts: ComposedShellPart[]): Promise<void>;
  unmountAll(): void;
}
