import {
  createDefaultLayoutState,
  sanitizeLayoutState,
  type PartialLayoutState,
} from "../layout.js";
import type {
  LayoutPersistenceOptions,
  LayoutEnvelopeV1,
  ShellLayoutPersistence,
  StorageLike,
  UnifiedShellPersistenceEnvelopeV1,
} from "./contracts.js";
import {
  getLegacyLayoutStorageKey,
  getUnifiedStorageKey,
  LAYOUT_SECTION_SCHEMA_VERSION,
  loadUnifiedEnvelope,
  migrateLayoutSectionEnvelope,
  SHELL_PERSISTENCE_SCHEMA_VERSION,
} from "./envelope.js";

export function createLocalStorageLayoutPersistence(
  storage: StorageLike | undefined,
  options: LayoutPersistenceOptions,
): ShellLayoutPersistence {
  const storageKey = getUnifiedStorageKey(options.userId);
  const legacyStorageKey = getLegacyLayoutStorageKey(options.userId);

  return {
    load() {
      if (!storage) {
        return createDefaultLayoutState();
      }

      const persistedEnvelope = loadUnifiedEnvelope(storage, storageKey);
      if (persistedEnvelope.ok) {
        const section = migrateLayoutSectionEnvelope(persistedEnvelope.value.layout);
        if (section.ok) {
          return sanitizeLayoutState(section.value.state as PartialLayoutState);
        }
      }

      const rawLegacy = storage.getItem(legacyStorageKey);
      if (!rawLegacy) {
        return createDefaultLayoutState();
      }

      const legacy = safeParse(rawLegacy);
      if (!legacy) {
        return createDefaultLayoutState();
      }

      return sanitizeLayoutState(legacy);
    },
    save(state) {
      if (!storage) {
        return;
      }

      const safeState = sanitizeLayoutState(state);
      const existingEnvelope = loadUnifiedEnvelope(storage, storageKey);
      const nextEnvelope: UnifiedShellPersistenceEnvelopeV1 = {
        version: SHELL_PERSISTENCE_SCHEMA_VERSION,
        ...(existingEnvelope.ok
          ? {
              layout: existingEnvelope.value.layout,
              context: existingEnvelope.value.context,
            }
          : {}),
        layout: {
          version: LAYOUT_SECTION_SCHEMA_VERSION,
          state: safeState,
        } satisfies LayoutEnvelopeV1,
      };

      storage.setItem(storageKey, JSON.stringify(nextEnvelope));
    },
  };
}

function safeParse(input: string): PartialLayoutState | null {
  try {
    return JSON.parse(input) as PartialLayoutState;
  } catch {
    return null;
  }
}
