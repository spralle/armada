import type { ContributionPredicateMatcher } from "@ghost-shell/contracts";
import { createEventEmitter } from "@ghost-shell/contracts";
import type {
  Event,
  KeySequencePendingEvent,
  KeySequenceCompletedEvent,
  KeySequenceCancelledEvent,
} from "@ghost-shell/contracts";
import { dispatchAction } from "../action-surface.js";
import type {
  ActionKeybinding,
  ActionSurface,
  ActionSurfaceContext,
  InvokableAction,
} from "../action-surface.js";
import type { IntentRuntime } from "../intent-runtime.js";
import {
  normalizeConfiguredSequence,
  normalizeKeyboardEventChord,
  type NormalizedKeybindingChord,
} from "./keybinding-normalizer.js";
import {
  resolveKeybindingSequence,
  type KeybindingLayer,
  type RegisteredKeybindingRecord,
  type ResolvedKeybinding,
} from "./keybinding-resolver.js";

const DEFAULT_LAYER_PRECEDENCE: readonly KeybindingLayer[] = ["user-overrides", "plugins", "defaults"];

export interface KeybindingLayerInput {
  layer: KeybindingLayer;
  entries: readonly ActionKeybinding[];
}

export interface KeybindingResolution {
  /** The sequence of chords that were resolved */
  chords: readonly NormalizedKeybindingChord[];
  match: ResolvedKeybinding | null;
}

export interface SequenceKeyResolution {
  kind: "exact" | "prefix" | "none";
  chords: readonly NormalizedKeybindingChord[];
  match?: ResolvedKeybinding;
  prefixCount?: number;
}

export interface KeybindingDispatchResult {
  resolution: KeybindingResolution;
  executed: boolean;
}

export interface KeybindingService {
  normalizeEvent: (event: KeyboardEvent) => NormalizedKeybindingChord | null;
  /** Legacy single-chord resolve — still works, delegates internally */
  resolve: (chord: NormalizedKeybindingChord, context: ActionSurfaceContext) => KeybindingResolution;
  /** Sequence-aware resolve — call with accumulated chords */
  resolveSequence: (chords: readonly NormalizedKeybindingChord[], context: ActionSurfaceContext) => SequenceKeyResolution;
  /** Legacy single-chord dispatch */
  dispatch: (chord: NormalizedKeybindingChord, context: ActionSurfaceContext) => Promise<KeybindingDispatchResult>;
  /** Sequence-aware dispatch — only dispatches on exact match */
  dispatchSequence: (chords: readonly NormalizedKeybindingChord[], context: ActionSurfaceContext) => Promise<KeybindingDispatchResult>;
  /** Check if any registered sequence starts with these chords */
  hasPrefix: (chords: readonly NormalizedKeybindingChord[], context: ActionSurfaceContext) => boolean;
  /** Timeout in ms for multi-chord sequence completion */
  readonly sequenceTimeoutMs: number;

  // --- Sequence lifecycle events ---
  readonly onDidKeySequencePending: Event<KeySequencePendingEvent>;
  readonly onDidKeySequenceCompleted: Event<KeySequenceCompletedEvent>;
  readonly onDidKeySequenceCancelled: Event<KeySequenceCancelledEvent>;

  /** Fire pending event (internal — used by keyboard handler) */
  fireKeySequencePending(data: KeySequencePendingEvent): void;
  /** Fire completed event (internal — used by keyboard handler) */
  fireKeySequenceCompleted(data: KeySequenceCompletedEvent): void;
  /** Fire cancelled event (internal — used by keyboard handler) */
  fireKeySequenceCancelled(data: KeySequenceCancelledEvent): void;
}

export interface KeybindingServiceOptions {
  actionSurface: ActionSurface;
  intentRuntime: IntentRuntime;
  defaultBindings?: readonly ActionKeybinding[];
  pluginBindings?: readonly ActionKeybinding[];
  userOverrideBindings?: readonly ActionKeybinding[];
  matcher?: ContributionPredicateMatcher;
  sequenceTimeoutMs?: number;
}

export function createKeybindingService(options: KeybindingServiceOptions): KeybindingService {
  const matcher = options.matcher;
  const sequenceTimeoutMs = options.sequenceTimeoutMs ?? 1000;
  const indexedActions = new Map(options.actionSurface.actions.map((action) => [action.id, action]));
  const layers = buildLayerInputs(options);
  const records = buildRegistryRecords(layers, indexedActions, DEFAULT_LAYER_PRECEDENCE);

  const pendingEmitter = createEventEmitter<KeySequencePendingEvent>();
  const completedEmitter = createEventEmitter<KeySequenceCompletedEvent>();
  const cancelledEmitter = createEventEmitter<KeySequenceCancelledEvent>();

  const resolveSequence = (chords: readonly NormalizedKeybindingChord[], context: ActionSurfaceContext): SequenceKeyResolution => {
    const result = resolveKeybindingSequence(records, chords, context, matcher);
    return {
      kind: result.kind,
      chords,
      match: result.match,
      prefixCount: result.prefixCount,
    };
  };

  const resolve = (chord: NormalizedKeybindingChord, context: ActionSurfaceContext): KeybindingResolution => {
    const seqResult = resolveSequence([chord], context);
    return {
      chords: [chord],
      match: seqResult.kind === "exact" ? (seqResult.match ?? null) : null,
    };
  };

  const dispatchSequence = async (chords: readonly NormalizedKeybindingChord[], context: ActionSurfaceContext): Promise<KeybindingDispatchResult> => {
    const seqResult = resolveSequence(chords, context);
    const resolution: KeybindingResolution = {
      chords,
      match: seqResult.kind === "exact" ? (seqResult.match ?? null) : null,
    };

    if (seqResult.kind !== "exact" || !seqResult.match) {
      return { resolution, executed: false };
    }

    const executed = await dispatchAction(
      options.actionSurface,
      options.intentRuntime,
      seqResult.match.action.id,
      context,
      matcher,
    );

    return { resolution, executed };
  };

  return {
    normalizeEvent: normalizeKeyboardEventChord,
    resolve,
    resolveSequence,
    async dispatch(chord, context) {
      return dispatchSequence([chord], context);
    },
    dispatchSequence,
    hasPrefix(chords, context) {
      const result = resolveKeybindingSequence(records, chords, context, matcher);
      return result.kind === "prefix";
    },
    sequenceTimeoutMs,
    onDidKeySequencePending: pendingEmitter.event,
    onDidKeySequenceCompleted: completedEmitter.event,
    onDidKeySequenceCancelled: cancelledEmitter.event,
    fireKeySequencePending: (data) => pendingEmitter.fire(data),
    fireKeySequenceCompleted: (data) => completedEmitter.fire(data),
    fireKeySequenceCancelled: (data) => cancelledEmitter.fire(data),
  };
}

function buildLayerInputs(options: KeybindingServiceOptions): KeybindingLayerInput[] {
  return [
    {
      layer: "defaults",
      entries: options.defaultBindings ?? [],
    },
    {
      layer: "plugins",
      entries: options.pluginBindings ?? options.actionSurface.keybindings,
    },
    {
      layer: "user-overrides",
      entries: options.userOverrideBindings ?? [],
    },
  ];
}

function buildRegistryRecords(
  layers: readonly KeybindingLayerInput[],
  indexedActions: ReadonlyMap<string, InvokableAction>,
  precedence: readonly KeybindingLayer[],
): RegisteredKeybindingRecord[] {
  const orderedLayers = [...layers].sort(
    (left, right) => precedence.indexOf(left.layer) - precedence.indexOf(right.layer),
  );

  const records: RegisteredKeybindingRecord[] = [];
  for (const layer of orderedLayers) {
    for (const entry of layer.entries) {
      const action = indexedActions.get(entry.action);
      if (!action) {
        continue;
      }

      const sequence = normalizeConfiguredSequence(entry.keybinding);
      if (!sequence) {
        continue;
      }

      records.push({
        action,
        sequence,
        when: entry.when,
        source: {
          layer: layer.layer,
          pluginId: entry.pluginId,
        },
      });
    }
  }

  return records;
}
