import { createInitialShellContextState, createInitialWorkspaceManagerState } from "@ghost-shell/state";
import type {
  ContextStateEnvelopeV2,
  ContextStatePersistenceOptions,
  ShellContextStatePersistence,
  ShellWorkspacePersistence,
  StorageLike,
  UnifiedShellPersistenceEnvelopeV1,
  WorkspacePersistenceEnvelopeV1,
} from "./contracts.js";
import {
  CONTEXT_STATE_SCHEMA_VERSION,
  getUnifiedStorageKey,
  loadUnifiedEnvelope,
  migrateContextStateEnvelope,
  migrateWorkspacePersistenceEnvelope,
  SHELL_PERSISTENCE_SCHEMA_VERSION,
  WORKSPACE_SCHEMA_VERSION,
} from "./envelope.js";
import { sanitizeContextState, sanitizeWorkspaceEnvelope } from "./sanitize.js";
import { sanitizeDockTreeStateWithReport } from "./sanitize-dock-tree.js";
import { isRecord } from "./utils.js";

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

export function createLocalStorageWorkspacePersistence(
  storage: StorageLike | undefined,
  options: ContextStatePersistenceOptions,
): ShellWorkspacePersistence {
  const storageKey = getUnifiedStorageKey(options.userId);

  return {
    load(fallback) {
      const safeFallback = sanitizeContextState(fallback, createInitialShellContextState());

      const defaultState = createInitialWorkspaceManagerState(safeFallback);

      if (!storage) {
        return {
          state: defaultState,
          warning: null,
        };
      }

      const persistedEnvelope = loadUnifiedEnvelope(storage, storageKey);
      if (!persistedEnvelope.ok) {
        return {
          state: defaultState,
          warning: persistedEnvelope.warning,
        };
      }

      const migration = migrateWorkspacePersistenceEnvelope(persistedEnvelope.value.context);
      if (!migration.ok) {
        return {
          state: defaultState,
          warning: migration.warning,
        };
      }

      const managerState = sanitizeWorkspaceEnvelope(migration.value, safeFallback);
      return {
        state: managerState,
        warning: migration.warning,
      };
    },

    save(workspaceManager, liveContextState) {
      if (!storage) {
        return { warning: null };
      }

      // Snapshot the live context state into the active workspace before serializing
      const workspaces: WorkspacePersistenceEnvelopeV1["workspaces"] = [];
      for (const id of workspaceManager.workspaceOrder) {
        const ws = workspaceManager.workspaces[id];
        if (!ws) continue;
        const contextState =
          id === workspaceManager.activeWorkspaceId
            ? sanitizeContextState(liveContextState, createInitialShellContextState())
            : sanitizeContextState(ws.contextState, createInitialShellContextState());
        workspaces.push({
          id: ws.id,
          name: ws.name,
          contextState,
        });
      }

      const workspaceEnvelope: WorkspacePersistenceEnvelopeV1 = {
        version: WORKSPACE_SCHEMA_VERSION,
        workspaces,
        activeWorkspaceId: workspaceManager.activeWorkspaceId,
        workspaceOrder: workspaceManager.workspaceOrder,
      };

      const existingEnvelope = loadUnifiedEnvelope(storage, storageKey);
      const nextEnvelope: UnifiedShellPersistenceEnvelopeV1 = {
        version: SHELL_PERSISTENCE_SCHEMA_VERSION,
        ...(existingEnvelope.ok
          ? {
              layout: existingEnvelope.value.layout,
              keybindings: existingEnvelope.value.keybindings,
            }
          : {}),
        context: workspaceEnvelope,
      };

      try {
        storage.setItem(storageKey, JSON.stringify(nextEnvelope));
        return { warning: null };
      } catch {
        return {
          warning: "Unable to persist workspace state locally.",
        };
      }
    },
  };
}
