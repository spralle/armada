import type {
  ContextStateEnvelopeV2,
  KeybindingOverridesEnvelopeV1,
  LayoutEnvelopeV1,
  StorageLike,
  UnifiedShellPersistenceEnvelopeV1,
} from "./contracts.js";

export const SHELL_PERSISTENCE_STORAGE_KEY = "ghost.shell.persistence";
export const SHELL_PERSISTENCE_SCHEMA_VERSION = 1;
export const LAYOUT_SECTION_SCHEMA_VERSION = 1;
export const CONTEXT_STATE_SCHEMA_VERSION = 2;
export const KEYBINDING_OVERRIDES_SCHEMA_VERSION = 1;

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

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object";
}
