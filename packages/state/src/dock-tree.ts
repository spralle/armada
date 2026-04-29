import { applyDockTabDrop } from "./dock-tree-drop.js";
import { deriveDeterministicActiveFromNode } from "./dock-tree-helpers.js";
import {
  cloneDockTree,
  createInitialDockTree,
  ensureTabRegisteredInDockTree,
  removeTabFromDockTree,
} from "./dock-tree-register-remove.js";
import type { DockNode, DockSplitNode, DockTabDropInput, DockTreeState } from "./dock-tree-types.js";

const DEFAULT_DOCK_SPLIT_RATIO = 0.5;
const MIN_DOCK_SPLIT_RATIO = 0.15;
const MAX_DOCK_SPLIT_RATIO = 0.85;

export { applyDockTabDrop, cloneDockTree, createInitialDockTree, ensureTabRegisteredInDockTree, removeTabFromDockTree };

export function readDockSplitRatio(node: Pick<DockSplitNode, "ratio">): number {
  return clampDockSplitRatio(node.ratio);
}

export function setDockSplitRatioById(tree: DockTreeState, splitId: string, ratio: number): DockTreeState {
  if (!tree.root) {
    return tree;
  }

  const nextRatio = clampDockSplitRatio(ratio);
  const nextRoot = updateSplitRatio(tree.root, splitId, nextRatio);
  if (!nextRoot) {
    return tree;
  }

  return {
    root: nextRoot,
  };
}

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

function updateSplitRatio(node: DockNode, splitId: string, ratio: number): DockNode | null {
  if (node.kind === "stack") {
    return null;
  }

  if (node.id === splitId) {
    if (readDockSplitRatio(node) === ratio) {
      return null;
    }

    return {
      ...node,
      ratio,
    };
  }

  const nextFirst = updateSplitRatio(node.first, splitId, ratio);
  const nextSecond = updateSplitRatio(node.second, splitId, ratio);
  if (!nextFirst && !nextSecond) {
    return null;
  }

  return {
    ...node,
    first: nextFirst ?? node.first,
    second: nextSecond ?? node.second,
  };
}

function clampDockSplitRatio(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_DOCK_SPLIT_RATIO;
  }

  return Math.min(MAX_DOCK_SPLIT_RATIO, Math.max(MIN_DOCK_SPLIT_RATIO, value));
}
