// keybinding-service.ts — Public KeybindingService contract for plugin consumption.
//
// Plugins access keybinding management via:
//   services.getService<KeybindingService>('ghost.keybinding.Service')

import type { Event } from "./event.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Payload for onDidKeySequencePending — a multi-chord sequence is in progress. */
export interface KeySequencePendingEvent {
  /** Chord values pressed so far, e.g. ["ctrl+k"] */
  pressedChords: string[];
  /** How many registered sequences still match as prefix */
  candidateCount: number;
}

/** Payload for onDidKeySequenceCompleted — a multi-chord sequence resolved to an action. */
export interface KeySequenceCompletedEvent {
  /** The full chord sequence that was matched */
  chords: string[];
  /** The action that was dispatched */
  actionId: string;
}

/** Payload for onDidKeySequenceCancelled — a multi-chord sequence was cancelled. */
export interface KeySequenceCancelledEvent {
  /** The chords that were accumulated before cancellation */
  chords: string[];
  /** Why the sequence was cancelled */
  reason: "timeout" | "no_match" | "escape";
}

/** A keybinding entry visible to consumers. */
export interface KeybindingEntry {
  id: string;
  key: string;
  action: string;
  when?: string | undefined;
}

/** A keybinding override visible to consumers. */
export interface KeybindingOverride {
  action: string;
  key: string;
}

// ---------------------------------------------------------------------------
// KeybindingService interface
// ---------------------------------------------------------------------------

export interface KeybindingService {
  /** Get the merged list of keybindings (defaults + plugin + overrides). */
  getKeybindings(): KeybindingEntry[];

  /** Get the current user overrides. */
  getOverrides(): KeybindingOverride[];

  /** Add or replace a keybinding override for an action. */
  addOverride(action: string, key: string): void;

  /** Remove the keybinding override for an action. */
  removeOverride(action: string): void;

  /** Reset all keybinding overrides to defaults. */
  resetAllOverrides(): void;

  /** Export overrides as a JSON string. */
  exportOverrides(): string;

  /** Import overrides from a JSON string. Returns count of imported entries and encountered errors. */
  importOverrides(json: string): { imported: number; errors: string[] };

  /** Fired when a multi-chord sequence is pending (waiting for more chords). */
  readonly onDidKeySequencePending: Event<KeySequencePendingEvent>;

  /** Fired when a multi-chord sequence completed and resolved to an action. */
  readonly onDidKeySequenceCompleted: Event<KeySequenceCompletedEvent>;

  /** Fired when a multi-chord sequence was cancelled (timeout, no match, or escape). */
  readonly onDidKeySequenceCancelled: Event<KeySequenceCancelledEvent>;
}

// ---------------------------------------------------------------------------
// Well-known service ID
// ---------------------------------------------------------------------------

/** Well-known service ID for the KeybindingService. */
export const KEYBINDING_SERVICE_ID = "ghost.keybinding.Service" as const;
