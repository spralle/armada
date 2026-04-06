import { deriveDeterministicActiveFromNode } from "./dock-tree-helpers.js";
import { applyDockTabDrop } from "./dock-tree-drop.js";
import {
  cloneDockTree,
  createInitialDockTree,
  ensureTabRegisteredInDockTree,
  removeTabFromDockTree,
} from "./dock-tree-register-remove.js";
import type { DockNode, DockTabDropInput, DockTreeState } from "./dock-tree-types.js";

export {
  applyDockTabDrop,
  cloneDockTree,
  createInitialDockTree,
  ensureTabRegisteredInDockTree,
  removeTabFromDockTree,
};

export function deriveDeterministicActiveTabId(tree: DockTreeState): string | null {
  if (!tree.root) {
    return null;
  }

  return deriveDeterministicActiveFromNode(tree.root);
}

export function moveTabWithinDockTree(tree: DockTreeState, input: DockTabDropInput): DockTreeState {
  return applyDockTabDrop(tree, input);
}

export function activateTabInDockTree(tree: DockTreeState, tabId: string): DockTreeState {
  const cloned = cloneDockTree(tree);
  if (!cloned.root) {
    return tree;
  }

  const activatedRoot = activateNode(cloned.root, tabId);
  if (!activatedRoot) {
    return tree;
  }

  return {
    root: activatedRoot,
  };
}

function activateNode(node: DockNode, tabId: string): DockNode {
  if (node.kind === "stack") {
    if (!node.tabIds.includes(tabId)) {
      return node;
    }

    return {
      ...node,
      activeTabId: tabId,
    };
  }

  return {
    ...node,
    first: activateNode(node.first, tabId),
    second: activateNode(node.second, tabId),
  };
}
