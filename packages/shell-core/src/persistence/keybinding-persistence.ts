import type {
  KeybindingOverrideEntryV1,
  KeybindingOverridesEnvelopeV1,
  KeybindingPersistenceOptions,
  ShellKeybindingPersistence,
  StorageLike,
  UnifiedShellPersistenceEnvelopeV1,
} from "./contracts.js";
import {
  getUnifiedStorageKey,
  KEYBINDING_OVERRIDES_SCHEMA_VERSION,
  loadUnifiedEnvelope,
  migrateKeybindingOverridesEnvelope,
  SHELL_PERSISTENCE_SCHEMA_VERSION,
} from "./envelope.js";

export function createLocalStorageKeybindingPersistence(
  storage: StorageLike | undefined,
  options: KeybindingPersistenceOptions,
): ShellKeybindingPersistence {
  const storageKey = getUnifiedStorageKey(options.userId);

  return {
    load() {
      if (!storage) {
        return [];
      }

      const persistedEnvelope = loadUnifiedEnvelope(storage, storageKey);
      if (!persistedEnvelope.ok) {
        return [];
      }

      const migration = migrateKeybindingOverridesEnvelope(persistedEnvelope.value.keybindings);
      if (!migration.ok) {
        return [];
      }

      return sanitizeOverrideEntries(migration.value.overrides);
    },
    save(overrides) {
      if (!storage) {
        return { warning: null };
      }

      const keybindingsEnvelope: KeybindingOverridesEnvelopeV1 = {
        version: KEYBINDING_OVERRIDES_SCHEMA_VERSION,
        overrides: sanitizeOverrideEntries(overrides),
      };
      const existingEnvelope = loadUnifiedEnvelope(storage, storageKey);
      const nextEnvelope: UnifiedShellPersistenceEnvelopeV1 = {
        version: SHELL_PERSISTENCE_SCHEMA_VERSION,
        ...(existingEnvelope.ok
          ? {
              layout: existingEnvelope.value.layout,
              context: existingEnvelope.value.context,
              keybindings: existingEnvelope.value.keybindings,
            }
          : {}),
        keybindings: keybindingsEnvelope,
      };

      try {
        storage.setItem(storageKey, JSON.stringify(nextEnvelope));
        return { warning: null };
      } catch {
        return {
          warning: "Unable to persist keybinding overrides locally.",
        };
      }
    },
  };
}

function sanitizeOverrideEntries(entries: KeybindingOverrideEntryV1[]): KeybindingOverrideEntryV1[] {
  return entries.filter(
    (entry) =>
      typeof entry.action === "string" &&
      entry.action.length > 0 &&
      typeof entry.keybinding === "string" &&
      entry.keybinding.length > 0,
  );
}
