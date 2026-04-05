import {
  createDefaultLayoutState,
  sanitizeLayoutState,
  type PartialLayoutState,
  type ShellLayoutState,
} from "./layout.js";
import {
  createInitialShellContextState,
  type ContextGroup,
  type ContextLaneValue,
  type EntityTypeSelection,
  type RevisionMeta,
  type ShellContextState,
} from "./context-state.js";

export interface ShellLayoutPersistence {
  load(): ShellLayoutState;
  save(state: ShellLayoutState): void;
}

export interface ContextStateLoadResult {
  state: ShellContextState;
  warning: string | null;
}

export interface ContextStateSaveResult {
  warning: string | null;
}

export interface ShellContextStatePersistence {
  load(fallback: ShellContextState): ContextStateLoadResult;
  save(state: ShellContextState): ContextStateSaveResult;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const SHELL_PERSISTENCE_STORAGE_KEY = "armada.shell.persistence";
const LAYOUT_STORAGE_KEY = "armada.shell.layout.v1";
const CONTEXT_STATE_STORAGE_KEY = "armada.shell.context-state";
const SHELL_PERSISTENCE_SCHEMA_VERSION = 1;
const LAYOUT_SECTION_SCHEMA_VERSION = 1;
const CONTEXT_STATE_SCHEMA_VERSION = 2;

interface LayoutPersistenceOptions {
  userId: string;
}

interface ContextStatePersistenceOptions {
  userId: string;
}

interface UnifiedShellPersistenceEnvelopeV1 {
  version: 1;
  layout?: unknown;
  context?: unknown;
}

interface LayoutEnvelopeV1 {
  version: 1;
  state: unknown;
}

interface ContextStateEnvelopeV2 {
  version: 2;
  contextState: unknown;
}

interface ContextStateEnvelopeV1 {
  version: 1;
  state: unknown;
}

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

function getUnifiedStorageKey(userId: string): string {
  return `${SHELL_PERSISTENCE_STORAGE_KEY}.v${SHELL_PERSISTENCE_SCHEMA_VERSION}.${userId}`;
}

function getLegacyLayoutStorageKey(userId: string): string {
  return `${LAYOUT_STORAGE_KEY}.${userId}`;
}

function getLegacyContextStorageKey(userId: string): string {
  return `${CONTEXT_STATE_STORAGE_KEY}.v${CONTEXT_STATE_SCHEMA_VERSION}.${userId}`;
}

function safeParse(input: string): PartialLayoutState | null {
  try {
    return JSON.parse(input) as Partial<ShellLayoutState>;
  } catch {
    return null;
  }
}

function safeParseUnknown(input: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return {
      ok: true,
      value: JSON.parse(input),
    };
  } catch {
    return { ok: false };
  }
}

function loadUnifiedEnvelope(
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

function migrateUnifiedShellEnvelope(input: unknown):
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
    },
    warning: null,
  };
}

function migrateLayoutSectionEnvelope(input: unknown):
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

function loadLegacyContextState(
  storage: StorageLike,
  legacyStorageKey: string,
):
  | { ok: true; value: ContextStateEnvelopeV2; warning: string | null }
  | { ok: false; warning: string | null } {
  const legacyRaw = storage.getItem(legacyStorageKey);
  if (!legacyRaw) {
    return { ok: false, warning: null };
  }

  const parsedLegacy = safeParseUnknown(legacyRaw);
  if (!parsedLegacy.ok) {
    return {
      ok: false,
      warning: "Persisted context state was unreadable. Using defaults.",
    };
  }

  const migration = migrateContextStateEnvelope(parsedLegacy.value);
  if (!migration.ok) {
    return {
      ok: false,
      warning: migration.warning,
    };
  }

  return {
    ok: true,
    value: migration.value,
    warning: migration.warning,
  };
}

function migrateContextStateEnvelope(input: unknown):
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
    const legacy = input as ContextStateEnvelopeV1;
    return {
      ok: true,
      value: {
        version: 2,
        contextState: legacy.state,
      },
      warning: "Migrated persisted context state from schema v1.",
    };
  }

  return {
    ok: false,
    warning: `Persisted context state schema v${String(input.version)} is unsupported. Using defaults.`,
  };
}

function sanitizeContextState(input: unknown, fallback: ShellContextState): ShellContextState {
  if (!isRecord(input)) {
    return fallback;
  }

  const groups = sanitizeGroups(input.groups, fallback.groups);
  const tabs = sanitizeTabs(input.tabs, fallback.tabs);
  const tabOrder = sanitizeTabOrder(input.tabOrder, tabs, fallback.tabOrder);
  const activeTabId = sanitizeActiveTabId(input.activeTabId, tabs, tabOrder, fallback.activeTabId);

  return {
    groups,
    tabs,
    tabOrder,
    activeTabId,
    globalLanes: sanitizeLaneMap(input.globalLanes, fallback.globalLanes),
    groupLanes: sanitizeNestedLaneMap(input.groupLanes, fallback.groupLanes),
    subcontextsByTab: sanitizeNestedLaneMap(input.subcontextsByTab, fallback.subcontextsByTab),
    selectionByEntityType: sanitizeSelectionMap(input.selectionByEntityType, fallback.selectionByEntityType),
  };
}

function sanitizeGroups(input: unknown, fallback: Record<string, ContextGroup>): Record<string, ContextGroup> {
  if (!isRecord(input)) {
    return { ...fallback };
  }

  const next: Record<string, ContextGroup> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!isRecord(raw)) {
      continue;
    }
    const id = typeof raw.id === "string" && raw.id ? raw.id : key;
    const color = typeof raw.color === "string" && raw.color ? raw.color : "blue";
    next[id] = { id, color };
  }

  return Object.keys(next).length > 0 ? next : { ...fallback };
}

function sanitizeTabs(
  input: unknown,
  fallback: Record<string, { id: string; groupId: string }>,
): Record<string, { id: string; groupId: string }> {
  if (!isRecord(input)) {
    return { ...fallback };
  }

  const next: Record<string, { id: string; groupId: string }> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!isRecord(raw)) {
      continue;
    }
    const id = typeof raw.id === "string" && raw.id ? raw.id : key;
    const groupId = typeof raw.groupId === "string" && raw.groupId ? raw.groupId : "group-main";
    next[id] = { id, groupId };
  }

  return Object.keys(next).length > 0 ? next : { ...fallback };
}

function sanitizeTabOrder(
  input: unknown,
  tabs: Record<string, { id: string; groupId: string }>,
  fallback: string[],
): string[] {
  const validTabIds = new Set(Object.keys(tabs));
  if (!Array.isArray(input)) {
    return fallback.filter((id) => validTabIds.has(id));
  }

  const seen = new Set<string>();
  const ordered = input
    .filter((value): value is string => typeof value === "string")
    .filter((id) => validTabIds.has(id))
    .filter((id) => {
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });

  for (const id of validTabIds) {
    if (!seen.has(id)) {
      ordered.push(id);
    }
  }

  return ordered.length > 0 ? ordered : fallback;
}

function sanitizeActiveTabId(
  input: unknown,
  tabs: Record<string, { id: string; groupId: string }>,
  tabOrder: string[],
  fallback: string | null,
): string | null {
  if (typeof input === "string" && tabs[input]) {
    return input;
  }

  if (fallback && tabs[fallback]) {
    return fallback;
  }

  return tabOrder[0] ?? null;
}

function sanitizeNestedLaneMap(
  input: unknown,
  fallback: Record<string, Record<string, ContextLaneValue>>,
): Record<string, Record<string, ContextLaneValue>> {
  if (!isRecord(input)) {
    return cloneNestedLaneMap(fallback);
  }

  const next: Record<string, Record<string, ContextLaneValue>> = {};
  for (const [scopeKey, scopeValue] of Object.entries(input)) {
    next[scopeKey] = sanitizeLaneMap(scopeValue, fallback[scopeKey] ?? {});
  }
  return next;
}

function sanitizeLaneMap(
  input: unknown,
  fallback: Record<string, ContextLaneValue>,
): Record<string, ContextLaneValue> {
  if (!isRecord(input)) {
    return { ...fallback };
  }

  const next: Record<string, ContextLaneValue> = {};
  for (const [key, raw] of Object.entries(input)) {
    const lane = sanitizeLaneValue(raw);
    if (lane) {
      next[key] = lane;
    }
  }
  return next;
}

function sanitizeLaneValue(input: unknown): ContextLaneValue | null {
  if (!isRecord(input)) {
    return null;
  }

  if (typeof input.value !== "string") {
    return null;
  }

  const revision = sanitizeRevision(input.revision);
  if (!revision) {
    return null;
  }

  const sourceSelection = isRecord(input.sourceSelection)
    && typeof input.sourceSelection.entityType === "string"
    && sanitizeRevision(input.sourceSelection.revision)
    ? {
      entityType: input.sourceSelection.entityType,
      revision: sanitizeRevision(input.sourceSelection.revision) as RevisionMeta,
    }
    : undefined;

  return {
    value: input.value,
    revision,
    valueType: typeof input.valueType === "string" ? input.valueType : undefined,
    sourceSelection,
  };
}

function sanitizeRevision(input: unknown): RevisionMeta | null {
  if (!isRecord(input)) {
    return null;
  }

  if (typeof input.timestamp !== "number" || !Number.isFinite(input.timestamp)) {
    return null;
  }

  if (typeof input.writer !== "string" || input.writer.length === 0) {
    return null;
  }

  return {
    timestamp: input.timestamp,
    writer: input.writer,
  };
}

function sanitizeSelectionMap(
  input: unknown,
  fallback: Record<string, EntityTypeSelection>,
): Record<string, EntityTypeSelection> {
  if (!isRecord(input)) {
    return cloneSelectionMap(fallback);
  }

  const next: Record<string, EntityTypeSelection> = {};
  for (const [entityType, raw] of Object.entries(input)) {
    const selection = sanitizeSelection(raw);
    if (selection) {
      next[entityType] = selection;
    }
  }
  return next;
}

function sanitizeSelection(input: unknown): EntityTypeSelection | null {
  if (!isRecord(input) || !Array.isArray(input.selectedIds)) {
    return null;
  }

  const selectedIds = normalizeIds(input.selectedIds);
  const rawPriority = typeof input.priorityId === "string" ? input.priorityId : null;
  const priorityId = rawPriority && selectedIds.includes(rawPriority)
    ? rawPriority
    : (selectedIds[0] ?? null);

  return {
    selectedIds,
    priorityId,
  };
}

function normalizeIds(input: unknown[]): string[] {
  const deduped = new Set<string>();
  for (const value of input) {
    if (typeof value === "string" && value) {
      deduped.add(value);
    }
  }
  return [...deduped];
}

function cloneNestedLaneMap(
  input: Record<string, Record<string, ContextLaneValue>>,
): Record<string, Record<string, ContextLaneValue>> {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, { ...value }]));
}

function cloneSelectionMap(input: Record<string, EntityTypeSelection>): Record<string, EntityTypeSelection> {
  return Object.fromEntries(
    Object.entries(input).map(([entityType, selection]) => [
      entityType,
      {
        selectedIds: [...selection.selectedIds],
        priorityId: selection.priorityId,
      },
    ]),
  );
}

function isRecord(input: unknown): input is Record<string, any> {
  return Boolean(input) && typeof input === "object";
}
