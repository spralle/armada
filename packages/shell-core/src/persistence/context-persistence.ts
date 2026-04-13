import { createInitialShellContextState } from "../state/context-state.js";
import type {
  ContextStateEnvelopeV2,
  ContextStatePersistenceOptions,
  ShellContextStatePersistence,
  StorageLike,
  UnifiedShellPersistenceEnvelopeV1,
} from "./contracts.js";
import {
  CONTEXT_STATE_SCHEMA_VERSION,
  getUnifiedStorageKey,
  loadUnifiedEnvelope,
  migrateContextStateEnvelope,
  SHELL_PERSISTENCE_SCHEMA_VERSION,
} from "./envelope.js";
import { sanitizeDockTreeStateWithReport } from "./sanitize-dock-tree.js";
import { sanitizeContextState } from "./sanitize.js";

export function createLocalStorageContextStatePersistence(
  storage: StorageLike | undefined,
  options: ContextStatePersistenceOptions,
): ShellContextStatePersistence {
  const storageKey = getUnifiedStorageKey(options.userId);

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
          const sanitizedState = sanitizeContextState(migration.value.contextState, safeFallback);
          const dockReport = sanitizeDockTreeStateWithReport(
            getDockTreeInput(migration.value.contextState),
            sanitizedState.tabs,
            sanitizedState.tabOrder,
            sanitizedState.activeTabId,
          );
          return {
            state: sanitizedState,
            warning: joinWarnings(migration.warning, dockReport.warning),
          };
        }

        sectionWarning = migration.warning;
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
              keybindings: existingEnvelope.value.keybindings,
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

function getDockTreeInput(input: unknown): unknown {
  if (!isRecord(input)) {
    return undefined;
  }

  return input.dockTree;
}

function joinWarnings(first: string | null, second: string | null): string | null {
  if (first && second) {
    return `${first} ${second}`;
  }

  return first ?? second;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object";
}
