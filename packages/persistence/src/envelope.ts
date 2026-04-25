import type {
  ContextStateEnvelopeV2,
  KeybindingOverridesEnvelopeV1,
  LayoutEnvelopeV1,
  StorageLike,
  UnifiedShellPersistenceEnvelopeV1,
  WorkspacePersistenceEnvelopeV1,
} from "./contracts.js";
import { isRecord } from "./utils.js";

export const SHELL_PERSISTENCE_STORAGE_KEY = "ghost.shell.persistence";
export const SHELL_PERSISTENCE_SCHEMA_VERSION = 1;
export const LAYOUT_SECTION_SCHEMA_VERSION = 1;
export const CONTEXT_STATE_SCHEMA_VERSION = 2;
export const WORKSPACE_SCHEMA_VERSION = 3;
export const KEYBINDING_OVERRIDES_SCHEMA_VERSION = 1;

/**
 * Read the existing unified envelope from storage, overwrite one section,
 * and write back. Returns the serialized envelope for callers that need
 * custom error handling.
 */
export function mergeAndSaveEnvelope(
  storage: StorageLike,
  storageKey: string,
  sectionName: "layout" | "context" | "keybindings",
  sectionData: unknown,
): void {
  const existing = loadUnifiedEnvelope(storage, storageKey);
  const envelope = {
    version: SHELL_PERSISTENCE_SCHEMA_VERSION as 1,
    ...(existing.ok
      ? {
          layout: existing.value.layout,
          context: existing.value.context,
          keybindings: existing.value.keybindings,
        }
      : {}),
    [sectionName]: sectionData,
  };
  storage.setItem(storageKey, JSON.stringify(envelope));
}

export function getUnifiedStorageKey(userId: string): string {
  return `${SHELL_PERSISTENCE_STORAGE_KEY}.v${SHELL_PERSISTENCE_SCHEMA_VERSION}.${userId}`;
}

export function safeParseUnknown(input: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return {
      ok: true,
      value: JSON.parse(input),
    };
  } catch {
    return { ok: false };
  }
}

export function loadUnifiedEnvelope(
  storage: StorageLike,
  storageKey: string,
):
  | { ok: true; value: UnifiedShellPersistenceEnvelopeV1; warning: null }
  | { ok: false; warning: string | null } {
  const raw = storage.getItem(storageKey);
  if (!raw) {
    return { ok: false, warning: null };
  }

  const parsed = safeParseUnknown(raw);
  if (!parsed.ok) {
    return {
      ok: false,
      warning: "Persisted shell state was unreadable. Using defaults.",
    };
  }

  return migrateUnifiedShellEnvelope(parsed.value);
}

export function migrateUnifiedShellEnvelope(input: unknown):
  | { ok: true; value: UnifiedShellPersistenceEnvelopeV1; warning: null }
  | { ok: false; warning: string } {
  if (!isRecord(input) || typeof input.version !== "number") {
    return {
      ok: false,
      warning: "Persisted shell state had invalid schema envelope. Using defaults.",
    };
  }

  if (input.version !== SHELL_PERSISTENCE_SCHEMA_VERSION) {
    return {
      ok: false,
      warning: `Persisted shell state schema v${String(input.version)} is unsupported. Using defaults.`,
    };
  }

  return {
    ok: true,
    value: {
      version: SHELL_PERSISTENCE_SCHEMA_VERSION,
      layout: input.layout,
      context: input.context,
      keybindings: input.keybindings,
    },
    warning: null,
  };
}

export function migrateLayoutSectionEnvelope(input: unknown):
  | { ok: true; value: LayoutEnvelopeV1; warning: string | null }
  | { ok: false; warning: string } {
  if (input === undefined) {
    return {
      ok: false,
      warning: "Persisted layout section was missing. Using defaults.",
    };
  }

  if (isRecord(input) && typeof input.version === "number") {
    if (input.version === LAYOUT_SECTION_SCHEMA_VERSION && "state" in input) {
      return {
        ok: true,
        value: {
          version: LAYOUT_SECTION_SCHEMA_VERSION,
          state: input.state,
        },
        warning: null,
      };
    }

    return {
      ok: false,
      warning: `Persisted layout section schema v${String(input.version)} is unsupported. Using defaults.`,
    };
  }

  if (isRecord(input)) {
    return {
      ok: true,
      value: {
        version: LAYOUT_SECTION_SCHEMA_VERSION,
        state: input,
      },
      warning: "Migrated persisted layout section from legacy schema.",
    };
  }

  return {
    ok: false,
    warning: "Persisted layout section payload was invalid. Using defaults.",
  };
}

export function migrateContextStateEnvelope(input: unknown):
  | { ok: true; value: ContextStateEnvelopeV2; warning: string | null }
  | { ok: false; warning: string | null } {
  if (input === undefined) {
    return {
      ok: false,
      warning: null,
    };
  }

  if (!isRecord(input) || typeof input.version !== "number") {
    return {
      ok: false,
      warning: "Persisted context state had invalid schema envelope. Using defaults.",
    };
  }

  if (input.version === 2) {
    if (!isRecord(input) || !("contextState" in input)) {
      return {
        ok: false,
        warning: "Persisted context state v2 payload was invalid. Using defaults.",
      };
    }

    return {
      ok: true,
      value: {
        version: 2,
        contextState: input.contextState,
      },
      warning: null,
    };
  }

  if (input.version === 1) {
    if (!("state" in input)) {
      return {
        ok: false,
        warning: "Persisted context state v1 payload was invalid. Using defaults.",
      };
    }

    return {
      ok: true,
      value: {
        version: 2,
        contextState: input.state,
      },
      warning: "Migrated persisted context state from schema v1.",
    };
  }

  return {
    ok: false,
    warning: `Persisted context state schema v${String(input.version)} is unsupported. Using defaults.`,
  };
}

export function migrateKeybindingOverridesEnvelope(input: unknown):
  | { ok: true; value: KeybindingOverridesEnvelopeV1; warning: string | null }
  | { ok: false; warning: string | null } {
  if (input === undefined) {
    return {
      ok: false,
      warning: null,
    };
  }

  if (!isRecord(input) || typeof input.version !== "number") {
    return {
      ok: false,
      warning: "Persisted keybinding overrides had invalid schema envelope. Using defaults.",
    };
  }

  if (input.version !== KEYBINDING_OVERRIDES_SCHEMA_VERSION) {
    return {
      ok: false,
      warning: `Persisted keybinding overrides schema v${String(input.version)} is unsupported. Using defaults.`,
    };
  }

  if (!Array.isArray(input.overrides)) {
    return {
      ok: false,
      warning: "Persisted keybinding overrides payload was invalid. Using defaults.",
    };
  }

  return {
    ok: true,
    value: {
      version: KEYBINDING_OVERRIDES_SCHEMA_VERSION,
      overrides: input.overrides as KeybindingOverridesEnvelopeV1["overrides"],
    },
    warning: null,
  };
}


/**
 * Migrate the `context` section of the unified envelope to workspace format.
 * - version 3: native workspace envelope
 * - version 1 or 2: legacy single context state → wrap as workspace "1"
 * - missing/invalid: return failure so caller uses defaults
 */
export function migrateWorkspacePersistenceEnvelope(input: unknown):
  | { ok: true; value: WorkspacePersistenceEnvelopeV1; warning: string | null }
  | { ok: false; warning: string | null } {
  if (input === undefined) {
    return { ok: false, warning: null };
  }

  if (!isRecord(input) || typeof input.version !== "number") {
    return {
      ok: false,
      warning: "Persisted context/workspace section had invalid schema envelope. Using defaults.",
    };
  }

  // Native workspace format
  if (input.version === WORKSPACE_SCHEMA_VERSION) {
    return parseWorkspaceEnvelope(input);
  }

  // Legacy single context state (v1 or v2) → migrate to single-workspace envelope
  const legacyMigration = migrateContextStateEnvelope(input);
  if (!legacyMigration.ok) {
    return legacyMigration;
  }

  return {
    ok: true,
    value: {
      version: WORKSPACE_SCHEMA_VERSION,
      workspaces: [
        {
          id: "1",
          name: "1",
          contextState: legacyMigration.value.contextState,
        },
      ],
      activeWorkspaceId: "1",
      workspaceOrder: ["1"],
    },
    warning: legacyMigration.warning
      ? `${legacyMigration.warning} Migrated single context state to workspace format.`
      : "Migrated single context state to workspace format.",
  };
}

function parseWorkspaceEnvelope(input: Record<string, unknown>):
  | { ok: true; value: WorkspacePersistenceEnvelopeV1; warning: string | null }
  | { ok: false; warning: string } {
  if (!Array.isArray(input.workspaces)) {
    return {
      ok: false,
      warning: "Persisted workspace envelope had invalid workspaces array. Using defaults.",
    };
  }

  const workspaces: WorkspacePersistenceEnvelopeV1["workspaces"] = [];
  for (const raw of input.workspaces) {
    if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id || typeof raw.name !== "string") {
      continue;
    }
    workspaces.push({
      id: raw.id,
      name: raw.name,
      contextState: raw.contextState,
    });
  }

  if (workspaces.length === 0) {
    return {
      ok: false,
      warning: "Persisted workspace envelope had no valid workspaces. Using defaults.",
    };
  }

  const workspaceIds = new Set(workspaces.map((w) => w.id));
  const activeWorkspaceId = typeof input.activeWorkspaceId === "string" && workspaceIds.has(input.activeWorkspaceId)
    ? input.activeWorkspaceId
    : workspaces[0].id;

  let workspaceOrder: string[];
  if (Array.isArray(input.workspaceOrder)) {
    const seen = new Set<string>();
    workspaceOrder = input.workspaceOrder
      .filter((id): id is string => typeof id === "string" && workspaceIds.has(id) && !seen.has(id))
      .map((id) => { seen.add(id); return id; });
    // Append remaining workspaces missing from order
    for (const ws of workspaces) {
      if (!seen.has(ws.id)) {
        workspaceOrder.push(ws.id);
      }
    }
  } else {
    workspaceOrder = workspaces.map((w) => w.id);
  }

  return {
    ok: true,
    value: {
      version: WORKSPACE_SCHEMA_VERSION,
      workspaces,
      activeWorkspaceId,
      workspaceOrder,
    },
    warning: null,
  };
}
