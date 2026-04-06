import {
  createInitialDockTree,
  ensureTabRegisteredInDockTree,
} from "../context-state/dock-tree.js";
import type {
  DockNode,
  DockOrientation,
  DockTreeState,
} from "../context-state/dock-tree-types.js";
import type { ContextTab } from "../context-state.js";

type SanitizedDockNode = DockNode | null;

export function sanitizeDockTreeState(
  input: unknown,
  tabs: Record<string, ContextTab>,
  tabOrder: string[],
  activeTabId: string | null,
): DockTreeState {
  const validTabIds = new Set(Object.keys(tabs));
  const root = isRecord(input)
    ? sanitizeDockNode(input.root, validTabIds)
    : null;

  const withNormalizedTree = root
    ? { root }
    : buildDockTreeFromTabOrder(tabOrder, activeTabId);

  let next = withNormalizedTree;
  for (const tabId of tabOrder) {
    if (validTabIds.has(tabId)) {
      next = ensureTabRegisteredInDockTree(next, tabId);
    }
  }

  return next;
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
