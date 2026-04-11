import type { ContributionPredicateMatcher } from "@armada/plugin-contracts";
import { dispatchAction } from "../action-surface.js";
import type {
  ActionKeybinding,
  ActionSurface,
  ActionSurfaceContext,
  InvokableAction,
} from "../action-surface.js";
import type { IntentRuntime } from "../intent-runtime.js";
import {
  normalizeConfiguredChord,
  normalizeKeyboardEventChord,
  type NormalizedKeybindingChord,
} from "./keybinding-normalizer.js";
import {
  resolveKeybindingMatch,
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
  chord: NormalizedKeybindingChord;
  match: ResolvedKeybinding | null;
}

export interface KeybindingDispatchResult {
  resolution: KeybindingResolution;
  executed: boolean;
}

export interface KeybindingService {
  normalizeEvent: (event: KeyboardEvent) => NormalizedKeybindingChord | null;
  resolve: (chord: NormalizedKeybindingChord, context: ActionSurfaceContext) => KeybindingResolution;
  dispatch: (chord: NormalizedKeybindingChord, context: ActionSurfaceContext) => Promise<KeybindingDispatchResult>;
}

export interface KeybindingServiceOptions {
  actionSurface: ActionSurface;
  intentRuntime: IntentRuntime;
  defaultBindings?: readonly ActionKeybinding[];
  pluginBindings?: readonly ActionKeybinding[];
  userOverrideBindings?: readonly ActionKeybinding[];
  matcher?: ContributionPredicateMatcher;
}

export function createKeybindingService(options: KeybindingServiceOptions): KeybindingService {
  const matcher = options.matcher;
  const indexedActions = new Map(options.actionSurface.actions.map((action) => [action.id, action]));
  const layers = buildLayerInputs(options);
  const records = buildRegistryRecords(layers, indexedActions, DEFAULT_LAYER_PRECEDENCE);

  const resolve = (chord: NormalizedKeybindingChord, context: ActionSurfaceContext): KeybindingResolution => ({
    chord,
    match: resolveKeybindingMatch(records, chord, context, matcher),
  });

  return {
    normalizeEvent: normalizeKeyboardEventChord,
    resolve,
    async dispatch(chord, context) {
      const resolution = resolve(chord, context);
      if (!resolution.match) {
        return {
          resolution,
          executed: false,
        };
      }

      const executed = await dispatchAction(
        options.actionSurface,
        options.intentRuntime,
        resolution.match.action.id,
        context,
        matcher,
      );

      return {
        resolution,
        executed,
      };
    },
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

      const chord = normalizeConfiguredChord(entry.keybinding);
      if (!chord) {
        continue;
      }

      records.push({
        action,
        chord,
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
