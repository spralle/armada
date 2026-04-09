import {
  createInitialDockTree,
  ensureTabRegisteredInDockTree,
  readDockSplitRatio,
} from "../context-state/dock-tree.js";
import type {
  DockNode,
  DockOrientation,
  DockTreeState,
} from "../context-state/dock-tree-types.js";
import type { ContextTab } from "../context-state.js";

type SanitizedDockNode = DockNode | null;

export interface DockTreeSanitizeResult {
  dockTree: DockTreeState;
  warning: string | null;
}

export function sanitizeDockTreeState(
  input: unknown,
  tabs: Record<string, ContextTab>,
  tabOrder: string[],
  activeTabId: string | null,
): DockTreeState {
  return sanitizeDockTreeStateWithReport(input, tabs, tabOrder, activeTabId).dockTree;
}

export function sanitizeDockTreeStateWithReport(
  input: unknown,
  tabs: Record<string, ContextTab>,
  tabOrder: string[],
  activeTabId: string | null,
): DockTreeSanitizeResult {
  const validTabIds = new Set(Object.keys(tabs));
  const legacySlotTabOrder = extractLegacySlotTabOrder(input, validTabIds);
  const root = isRecord(input)
    ? sanitizeDockNode(input.root, validTabIds)
    : null;

  const warning = resolveDockSanitizeWarning(input, root, legacySlotTabOrder);
  const normalizedTabOrder = legacySlotTabOrder.length > 0 ? legacySlotTabOrder : tabOrder;

  const withNormalizedTree = root
    ? { root }
    : buildDockTreeFromTabOrder(normalizedTabOrder, activeTabId);

  let next = withNormalizedTree;
  for (const tabId of tabOrder) {
    if (validTabIds.has(tabId)) {
      next = ensureTabRegisteredInDockTree(next, tabId);
    }
  }

  return {
    dockTree: next,
    warning,
  };
}

function sanitizeDockNode(input: unknown, validTabIds: Set<string>): SanitizedDockNode {
  if (!isRecord(input) || (input.kind !== "split" && input.kind !== "stack") || typeof input.id !== "string" || !input.id) {
    return null;
  }

  if (input.kind === "stack") {
    if (!Array.isArray(input.tabIds)) {
      return null;
    }

    const tabIds = dedupeTabIds(input.tabIds, validTabIds);
    if (tabIds.length === 0) {
      return null;
    }

    return {
      kind: "stack",
      id: input.id,
      tabIds,
      activeTabId: resolveStackActiveTab(input.activeTabId, tabIds),
    };
  }

  const orientation = sanitizeOrientation(input.orientation);
  if (!orientation) {
    return null;
  }

  const first = sanitizeDockNode(input.first, validTabIds);
  const second = sanitizeDockNode(input.second, validTabIds);
  if (!first && !second) {
    return null;
  }
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }

  return {
    kind: "split",
    id: input.id,
    orientation,
    ratio: readDockSplitRatio({
      ratio: typeof input.ratio === "number" ? input.ratio : undefined,
    }),
    first,
    second,
  };
}

function buildDockTreeFromTabOrder(tabOrder: string[], activeTabId: string | null): DockTreeState {
  const firstTabId = tabOrder[0];
  if (!firstTabId) {
    return { root: null };
  }

  let tree = createInitialDockTree(firstTabId);
  for (const tabId of tabOrder.slice(1)) {
    tree = ensureTabRegisteredInDockTree(tree, tabId);
  }

  if (!tree.root || tree.root.kind !== "stack") {
    return tree;
  }

  const normalizedActive = resolveStackActiveTab(activeTabId, tree.root.tabIds);
  return {
    root: {
      ...tree.root,
      activeTabId: normalizedActive,
    },
  };
}

function dedupeTabIds(input: unknown[], validTabIds: Set<string>): string[] {
  const seen = new Set<string>();
  const tabIds: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string" || !validTabIds.has(raw) || seen.has(raw)) {
      continue;
    }
    seen.add(raw);
    tabIds.push(raw);
  }

  return tabIds;
}

function resolveStackActiveTab(activeTabId: unknown, tabIds: string[]): string | null {
  if (typeof activeTabId === "string" && tabIds.includes(activeTabId)) {
    return activeTabId;
  }

  return tabIds[0] ?? null;
}

function sanitizeOrientation(value: unknown): DockOrientation | null {
  if (value === "horizontal" || value === "vertical") {
    return value;
  }
  return null;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object";
}

function resolveDockSanitizeWarning(
  input: unknown,
  root: DockNode | null,
  legacySlotTabOrder: string[],
): string | null {
  if (legacySlotTabOrder.length > 0) {
    return "Migrated persisted dock layout from legacy slot schema.";
  }

  if (!isRecord(input) || input.root === undefined) {
    return null;
  }

  if (input.root !== null && root === null) {
    return "Persisted dock layout payload was invalid. Using deterministic fallback.";
  }

  return null;
}

function extractLegacySlotTabOrder(input: unknown, validTabIds: Set<string>): string[] {
  if (!isRecord(input)) {
    return [];
  }

  const slotPayload = isRecord(input.tabsBySlot)
    ? input.tabsBySlot
    : isRecord(input.layoutBySlot)
      ? input.layoutBySlot
      : input;

  const main = collectLegacySlotTabIds(slotPayload.main, validTabIds);
  const secondary = collectLegacySlotTabIds(slotPayload.secondary, validTabIds);
  const side = collectLegacySlotTabIds(slotPayload.side, validTabIds);

  if (main.length === 0 && secondary.length === 0 && side.length === 0) {
    return [];
  }

  return [...new Set([...main, ...secondary, ...side])];
}

function collectLegacySlotTabIds(input: unknown, validTabIds: Set<string>): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const tabIds: string[] = [];
  for (const item of input) {
    const tabId = resolveLegacySlotTabId(item);
    if (tabId && validTabIds.has(tabId)) {
      tabIds.push(tabId);
    }
  }

  return tabIds;
}

function resolveLegacySlotTabId(input: unknown): string | null {
  if (typeof input === "string" && input) {
    return input;
  }

  if (!isRecord(input)) {
    return null;
  }

  if (typeof input.tabId === "string" && input.tabId) {
    return input.tabId;
  }

  if (typeof input.id === "string" && input.id) {
    return input.id;
  }

  return null;
}
