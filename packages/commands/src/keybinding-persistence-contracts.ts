/**
 * Local persistence contracts for the commands package.
 * These mirror the shapes from @ghost-shell/persistence so that
 * the commands package does not depend on the persistence package directly.
 * Callers inject concrete implementations at construction time.
 */

export interface KeybindingOverrideEntry {
  action: string;
  keybinding: string;
  removed?: boolean;
}

export interface KeybindingPersistence {
  load(): KeybindingOverrideEntry[];
  save(overrides: KeybindingOverrideEntry[]): { warning: string | null };
}
