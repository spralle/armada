// keybinding-service.ts — Public KeybindingService contract for plugin consumption.
//
// Plugins access keybinding management via:
//   services.getService<KeybindingService>('ghost.keybinding.Service')

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A keybinding entry visible to consumers. */
export interface KeybindingEntry {
  id: string;
  key: string;
  command: string;
  when?: string | undefined;
}

/** A keybinding override visible to consumers. */
export interface KeybindingOverride {
  command: string;
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

  /** Add or replace a keybinding override for a command. */
  addOverride(command: string, key: string): void;

  /** Remove the keybinding override for a command. */
  removeOverride(command: string): void;

  /** Reset all keybinding overrides to defaults. */
  resetAllOverrides(): void;

  /** Export overrides as a JSON string. */
  exportOverrides(): string;

  /** Import overrides from a JSON string. Returns count of imported entries and any errors. */
  importOverrides(json: string): { imported: number; errors: string[] };
}

// ---------------------------------------------------------------------------
// Well-known service ID
// ---------------------------------------------------------------------------

/** Well-known service ID for the KeybindingService. */
export const KEYBINDING_SERVICE_ID = "ghost.keybinding.Service" as const;
