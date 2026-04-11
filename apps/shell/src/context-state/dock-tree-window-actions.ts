import {
  deriveDeterministicActiveTabId,
  readDockSplitRatio,
  setDockSplitRatioById,
} from "./dock-tree.js";
import { cloneDockNode, collapseDockNode } from "./dock-tree-helpers.js";
import type { DockNode, DockStackNode, DockTreeState } from "./dock-tree-types.js";
import {
  collectSplitPath,
  collectStacks,
  computeSplitDelta,
  directionalDistance,
  findNearestSplitForDirection,
  findStackById,
  findStackByTabId,
} from "./dock-tree-window-actions-helpers.js";

type DockDirection = "left" | "right" | "up" | "down";

const RESIZE_STEP = 0.05;

interface FocusTarget {
  stack: DockStackNode;
  depth: number;
}

export function focusDockStackInDirection(
  tree: DockTreeState,
  activeTabId: string,
  direction: DockDirection,
): { tree: DockTreeState; activeTabId: string | null; changed: boolean } {
  const source = findStackByTabId(tree.root, activeTabId);
  if (!source) {
    return { tree, activeTabId: deriveDeterministicActiveTabId(tree), changed: false };
  }

  const target = findDirectionalFocusTarget(tree.root, source.path, source.stack.id, direction);
  if (!target || !target.stack.activeTabId || target.stack.activeTabId === activeTabId) {
    return { tree, activeTabId, changed: false };
  }

  return {
    tree,
    activeTabId: target.stack.activeTabId,
    changed: true,
  };
}

export function moveActiveTabInDirection(
  tree: DockTreeState,
  activeTabId: string,
  direction: DockDirection,
): { tree: DockTreeState; activeTabId: string | null; changed: boolean } {
  const source = findStackByTabId(tree.root, activeTabId);
  if (!source) {
    return { tree, activeTabId: deriveDeterministicActiveTabId(tree), changed: false };
  }

  const target = findDirectionalFocusTarget(tree.root, source.path, source.stack.id, direction);
  if (!target || target.stack.id === source.stack.id) {
    return { tree, activeTabId, changed: false };
  }

  const sourceIndex = source.stack.tabIds.indexOf(activeTabId);
  if (sourceIndex < 0) {
    return { tree, activeTabId, changed: false };
  }

  const nextRoot = cloneDockNode(tree.root);
  if (!nextRoot) {
    return { tree, activeTabId, changed: false };
  }

  const nextSource = findStackByTabId(nextRoot, activeTabId);
  if (!nextSource) {
    return { tree, activeTabId, changed: false };
  }

  nextSource.stack.tabIds = nextSource.stack.tabIds.filter((tabId) => tabId !== activeTabId);
  nextSource.stack.activeTabId = nextSource.stack.tabIds[0] ?? null;

  const collapsedRoot = collapseDockNode(nextRoot);
  if (!collapsedRoot) {
    return { tree, activeTabId, changed: false };
  }

  const collapsedTarget = findStackById(collapsedRoot, target.stack.id);
  if (!collapsedTarget) {
    return { tree, activeTabId, changed: false };
  }

  const targetInsertIndex = collapsedTarget.stack.tabIds.indexOf(collapsedTarget.stack.activeTabId ?? "");
  const insertAt = targetInsertIndex < 0 ? collapsedTarget.stack.tabIds.length : targetInsertIndex + 1;
  collapsedTarget.stack.tabIds = [
    ...collapsedTarget.stack.tabIds.slice(0, insertAt),
    activeTabId,
    ...collapsedTarget.stack.tabIds.slice(insertAt),
  ];
  collapsedTarget.stack.activeTabId = activeTabId;

  return {
    tree: { root: collapsedRoot },
    activeTabId,
    changed: true,
  };
}

export function swapActiveTabInDirection(
  tree: DockTreeState,
  activeTabId: string,
  direction: DockDirection,
): { tree: DockTreeState; activeTabId: string | null; changed: boolean } {
  const source = findStackByTabId(tree.root, activeTabId);
  if (!source) {
    return { tree, activeTabId: deriveDeterministicActiveTabId(tree), changed: false };
  }

  const target = findDirectionalFocusTarget(tree.root, source.path, source.stack.id, direction);
  const targetTabId = target?.stack.activeTabId;
  if (!target || !targetTabId || target.stack.id === source.stack.id) {
    return { tree, activeTabId, changed: false };
  }

  const nextRoot = cloneDockNode(tree.root);
  if (!nextRoot) {
    return { tree, activeTabId, changed: false };
  }

  const nextSource = findStackByTabId(nextRoot, activeTabId);
  const nextTarget = findStackByTabId(nextRoot, targetTabId);
  if (!nextSource || !nextTarget) {
    return { tree, activeTabId, changed: false };
  }

  const sourceIndex = nextSource.stack.tabIds.indexOf(activeTabId);
  const targetIndex = nextTarget.stack.tabIds.indexOf(targetTabId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return { tree, activeTabId, changed: false };
  }

  nextSource.stack.tabIds[sourceIndex] = targetTabId;
  nextTarget.stack.tabIds[targetIndex] = activeTabId;
  nextSource.stack.activeTabId = targetTabId;
  nextTarget.stack.activeTabId = activeTabId;

  return {
    tree: { root: nextRoot },
    activeTabId,
    changed: true,
  };
}

export function resizeDockInDirection(
  tree: DockTreeState,
  activeTabId: string,
  direction: DockDirection,
): { tree: DockTreeState; changed: boolean } {
  const source = findStackByTabId(tree.root, activeTabId);
  if (!source) {
    return { tree, changed: false };
  }

  const split = findNearestSplitForDirection(tree.root, source.path, direction);
  if (!split) {
    return { tree, changed: false };
  }

  const currentRatio = readDockSplitRatio(split.node);
  const delta = computeSplitDelta(split.orientation, split.branch, direction, RESIZE_STEP);
  if (delta === 0) {
    return { tree, changed: false };
  }

  const nextTree = setDockSplitRatioById(tree, split.node.id, currentRatio + delta);
  return {
    tree: nextTree,
    changed: nextTree !== tree,
  };
}

function findDirectionalFocusTarget(
  root: DockNode | null,
  sourcePath: ReadonlyArray<"first" | "second">,
  sourceStackId: string,
  direction: DockDirection,
): FocusTarget | null {
  if (!root) {
    return null;
  }

  const sourceSplitPath = collectSplitPath(root, sourcePath);
  let best: FocusTarget | null = null;
  for (const candidate of collectStacks(root)) {
    if (candidate.stack.id === sourceStackId) {
      continue;
    }

    const distance = directionalDistance(sourcePath, candidate.path, sourceSplitPath, direction);
    if (distance === null) {
      continue;
    }

    if (!best || distance < best.depth) {
      best = { stack: candidate.stack, depth: distance };
    }
  }

  return best;
}
