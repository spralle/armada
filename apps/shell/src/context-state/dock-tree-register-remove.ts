import {
  cloneDockNode,
  collapseDockNode,
  findActiveOrFirstStack,
  hasTabInDockNode,
} from "./dock-tree-helpers.js";
import type { DockNode, DockTreeState } from "./dock-tree-types.js";

export function createInitialDockTree(tabId: string): DockTreeState {
  return {
    root: createStackNode(tabId, [tabId], tabId),
  };
}

export function cloneDockTree(tree: DockTreeState): DockTreeState {
  return {
    root: cloneDockNode(tree.root),
  };
}

export function ensureTabRegisteredInDockTree(tree: DockTreeState, tabId: string): DockTreeState {
  if (!tree.root) {
    return {
      root: createStackNode(tabId, [tabId], tabId),
    };
  }

  if (hasTabInDockNode(tree.root, tabId)) {
    return tree;
  }

  const nextRoot = cloneDockNode(tree.root);
  if (!nextRoot) {
    return {
      root: createStackNode(tabId, [tabId], tabId),
    };
  }

  const target = findActiveOrFirstStack(nextRoot);
  if (!target) {
    return {
      root: createStackNode(tabId, [tabId], tabId),
    };
  }

  target.tabIds = [...target.tabIds, tabId];
  target.activeTabId = target.activeTabId ?? tabId;
  return { root: nextRoot };
}

export function removeTabFromDockTree(tree: DockTreeState, tabId: string): DockTreeState {
  if (!tree.root || !hasTabInDockNode(tree.root, tabId)) {
    return tree;
  }

  const clonedRoot = cloneDockNode(tree.root);
  if (!clonedRoot) {
    return tree;
  }

  const nextRoot = removeTabFromNode(clonedRoot, tabId);
  return {
    root: collapseDockNode(nextRoot),
  };
}

function createStackNode(id: string, tabIds: string[], activeTabId: string | null): DockNode {
  return {
    kind: "stack",
    id,
    tabIds,
    activeTabId,
  };
}

function removeTabFromNode(node: DockNode, tabId: string): DockNode | null {
  if (node.kind === "stack") {
    if (!node.tabIds.includes(tabId)) {
      return node;
    }

    const removedIndex = node.tabIds.indexOf(tabId);
    const nextTabIds = node.tabIds.filter((id) => id !== tabId);
    if (nextTabIds.length === 0) {
      return null;
    }

    if (node.activeTabId !== tabId && node.activeTabId && nextTabIds.includes(node.activeTabId)) {
      return {
        ...node,
        tabIds: nextTabIds,
      };
    }

    const fallback = nextTabIds[removedIndex] ?? nextTabIds[removedIndex - 1] ?? nextTabIds[0] ?? null;
    return {
      ...node,
      tabIds: nextTabIds,
      activeTabId: fallback,
    };
  }

  const first = removeTabFromNode(node.first, tabId);
  const second = removeTabFromNode(node.second, tabId);
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
    ...node,
    first,
    second,
  };
}
