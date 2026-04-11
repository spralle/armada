// Adapter: bridges the existing ActionPaletteState into a QuickPickState.
// Temporary bridge — removed in Bead 8 when the action palette becomes a plugin.

import type { ActionPaletteEntry, ActionPaletteState } from "../../shell-runtime/action-palette-state.js";
import type { QuickPickState, ScoredQuickPickItem } from "./quick-pick-state.js";

/**
 * A QuickPickItem that wraps an ActionPaletteEntry.
 * Carries the original entry for the accept callback.
 */
export interface PaletteQuickPickItem {
  readonly label: string;
  readonly description?: string;
  readonly detail?: string;
  readonly enabled?: boolean;
  /** The original ActionPaletteEntry, used by the accept callback. */
  readonly entry: ActionPaletteEntry;
}

function toPaletteQuickPickItem(entry: ActionPaletteEntry): PaletteQuickPickItem {
  return {
    label: entry.title,
    description: entry.keybindingHint ?? undefined,
    detail: entry.disabledReason ?? undefined,
    enabled: entry.enabled,
    entry,
  };
}

/**
 * Convert an ActionPaletteState into a QuickPickState<PaletteQuickPickItem>.
 * Maps entries to QuickPickItems while preserving the scoring/selection state.
 */
export function adaptPaletteStateToQuickPick(
  state: ActionPaletteState,
): QuickPickState<PaletteQuickPickItem> {
  const items = state.entries.map(toPaletteQuickPickItem);

  const filteredItems: ScoredQuickPickItem<PaletteQuickPickItem>[] =
    state.filteredEntries.map((scored) => ({
      item: toPaletteQuickPickItem(scored.entry),
      score: scored.score,
    }));

  return {
    phase: state.phase,
    filter: state.filter,
    selectedIndex: state.selectedIndex,
    items,
    filteredItems,
    scoringOptions: {},
  };
}
