import type {
  ContextGroup,
  ContextLaneValue,
  ContextTab,
  EntityTypeSelection,
  RevisionMeta,
  ShellContextState,
} from "../context-state.js";

export function sanitizeContextState(input: unknown, fallback: ShellContextState): ShellContextState {
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
  fallback: Record<string, ContextTab>,
): Record<string, ContextTab> {
  if (!isRecord(input)) {
    return { ...fallback };
  }

  const next: Record<string, ContextTab> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!isRecord(raw)) {
      continue;
    }
    const id = typeof raw.id === "string" && raw.id ? raw.id : key;
    const groupId = typeof raw.groupId === "string" && raw.groupId ? raw.groupId : "group-main";
    const label = typeof raw.label === "string" && raw.label
      ? raw.label
      : (typeof raw.name === "string" && raw.name ? raw.name : id);
    const closePolicy = raw.closePolicy === "closeable" ? "closeable" : "fixed";
    next[id] = { id, groupId, label, closePolicy };
  }

  return Object.keys(next).length > 0 ? next : { ...fallback };
}

function sanitizeTabOrder(
  input: unknown,
  tabs: Record<string, ContextTab>,
  fallback: string[],
): string[] {
  const validTabIds = new Set(Object.keys(tabs));
  if (!Array.isArray(input)) {
    return normalizeTabOrderAgainstTabs(fallback, validTabIds);
  }

  const ordered = normalizeTabOrderAgainstTabs(input, validTabIds);

  return ordered.length > 0 ? ordered : normalizeTabOrderAgainstTabs(fallback, validTabIds);
}

function normalizeTabOrderAgainstTabs(input: unknown[], validTabIds: Set<string>): string[] {
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

  return ordered;
}

function sanitizeActiveTabId(
  input: unknown,
  tabs: Record<string, ContextTab>,
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

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object";
}
