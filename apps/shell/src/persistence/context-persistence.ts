import { createInitialShellContextState } from "../context-state.js";
import type {
  ContextStateEnvelopeV2,
  ContextStatePersistenceOptions,
  ShellContextStatePersistence,
  StorageLike,
  UnifiedShellPersistenceEnvelopeV1,
} from "./contracts.js";
import {
  CONTEXT_STATE_SCHEMA_VERSION,
  getLegacyContextStorageKey,
  getUnifiedStorageKey,
  loadLegacyContextState,
  loadUnifiedEnvelope,
  migrateContextStateEnvelope,
  SHELL_PERSISTENCE_SCHEMA_VERSION,
} from "./envelope.js";
import { sanitizeContextState } from "./sanitize.js";

export function createLocalStorageContextStatePersistence(
  storage: StorageLike | undefined,
  options: ContextStatePersistenceOptions,
): ShellContextStatePersistence {
  const storageKey = getUnifiedStorageKey(options.userId);
  const legacyStorageKey = getLegacyContextStorageKey(options.userId);

  return {
    load(fallback) {
      const safeFallback = sanitizeContextState(fallback, createInitialShellContextState());
      if (!storage) {
        return {
          state: safeFallback,
          warning: null,
        };
      }

      const persistedEnvelope = loadUnifiedEnvelope(storage, storageKey);
      let sectionWarning: string | null = null;
      if (persistedEnvelope.ok) {
        const migration = migrateContextStateEnvelope(persistedEnvelope.value.context);
        if (migration.ok) {
          return {
            state: sanitizeContextState(migration.value.contextState, safeFallback),
            warning: migration.warning,
          };
        }

        sectionWarning = migration.warning;
      }

      const legacy = loadLegacyContextState(storage, legacyStorageKey);
      if (legacy.ok) {
        return {
          state: sanitizeContextState(legacy.value.contextState, safeFallback),
          warning: legacy.warning,
        };
      }

      if (legacy.warning) {
        return {
          state: safeFallback,
          warning: legacy.warning,
        };
      }

      if (persistedEnvelope.warning) {
        return {
          state: safeFallback,
          warning: persistedEnvelope.warning,
        };
      }

      if (sectionWarning) {
        return {
          state: safeFallback,
          warning: sectionWarning,
        };
      }

      return {
        state: safeFallback,
        warning: null,
      };
    },
    save(state) {
      if (!storage) {
        return { warning: null };
      }

      const safeState = sanitizeContextState(state, createInitialShellContextState());
      const contextEnvelope: ContextStateEnvelopeV2 = {
        version: CONTEXT_STATE_SCHEMA_VERSION,
        contextState: safeState,
      };
      const existingEnvelope = loadUnifiedEnvelope(storage, storageKey);
      const nextEnvelope: UnifiedShellPersistenceEnvelopeV1 = {
        version: SHELL_PERSISTENCE_SCHEMA_VERSION,
        ...(existingEnvelope.ok
          ? {
              layout: existingEnvelope.value.layout,
              context: existingEnvelope.value.context,
            }
          : {}),
        context: contextEnvelope,
      };

      try {
        storage.setItem(storageKey, JSON.stringify(nextEnvelope));
        return { warning: null };
      } catch {
        return {
          warning: "Unable to persist context state locally.",
        };
      }
    },
  };
}
