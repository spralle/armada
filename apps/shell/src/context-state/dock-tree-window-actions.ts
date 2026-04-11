import {
  deriveDeterministicActiveTabId,
  readDockSplitRatio,
  setDockSplitRatioById,
} from "./dock-tree.js";
import { cloneDockNode, collapseDockNode } from "./dock-tree-helpers.js";
import type { DockNode, DockOrientation, DockSplitNode, DockStackNode, DockTreeState } from "./dock-tree-types.js";

type DockDirection = "left" | "right" | "up" | "down";

const RESIZE_STEP = 0.05;

interface StackRef {
  stack: DockStackNode;
  path: ReadonlyArray<"first" | "second">;
}

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
  const target = findDirectionalFocusTarget(tree.root, source, direction);
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
  const target = findDirectionalFocusTarget(tree.root, source, direction);
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
  const nextTarget = findStackById(nextRoot, target.stack.id);
  if (!nextSource || !nextTarget) {
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
  const nextTree = { root: collapsedRoot };
  return {
    tree: nextTree,
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
  const target = findDirectionalFocusTarget(tree.root, source, direction);
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
  const delta = computeSplitDelta(split.orientation, split.branch, direction);
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
  source: StackRef,
  direction: DockDirection,
): FocusTarget | null {
  if (!root) {
    return null;
  }
  const sourceSplitPath = collectSplitPath(root, source.path);
  let best: FocusTarget | null = null;
  for (const candidate of collectStacks(root)) {
    if (candidate.stack.id === source.stack.id) {
      continue;
    }
    const distance = directionalDistance(source.path, candidate.path, sourceSplitPath, direction);
    if (distance === null) {
      continue;
    }
    if (!best || distance < best.depth) {
      best = { stack: candidate.stack, depth: distance };
    }
  }
  return best;
}

function directionalDistance(
  fromPath: ReadonlyArray<"first" | "second">,
  toPath: ReadonlyArray<"first" | "second">,
  sourceSplitPath: readonly DockSplitNode[],
  direction: DockDirection,
): number | null {
  const length = Math.min(fromPath.length, toPath.length);
  let divergence = -1;
  for (let index = 0; index < length; index += 1) {
    if (fromPath[index] !== toPath[index]) {
      divergence = index;
      break;
    }
  }

  if (divergence < 0) {
    return null;
  }
  const fromBranch = fromPath[divergence];
  const toBranch = toPath[divergence];
  const split = sourceSplitPath[divergence];
  if (!split) {
    return null;
  }
  const expectedOrientation: DockOrientation = direction === "left" || direction === "right"
    ? "horizontal"
    : "vertical";
  if (split.orientation !== expectedOrientation) {
    return null;
  }
  if (
    (direction === "left" || direction === "up") && fromBranch === "second" && toBranch === "first"
    || (direction === "right" || direction === "down") && fromBranch === "first" && toBranch === "second"
  ) {
    return fromPath.length - divergence;
  }

  return null;
}

function collectSplitPath(root: DockNode, path: ReadonlyArray<"first" | "second">): DockSplitNode[] {
  const splits: DockSplitNode[] = [];
  let cursor: DockNode = root;
  for (const branch of path) {
    if (cursor.kind !== "split") {
      break;
    }
    splits.push(cursor);
    cursor = branch === "first" ? cursor.first : cursor.second;
  }
  return splits;
}

function findNearestSplitForDirection(
  root: DockNode | null,
  path: ReadonlyArray<"first" | "second">,
  direction: DockDirection,
): { node: DockSplitNode; branch: "first" | "second"; orientation: DockOrientation } | null {
  if (!root) {
    return null;
  }
  const splitPath: DockSplitNode[] = [];
  let cursor: DockNode = root;
  for (const branch of path) {
    if (cursor.kind !== "split") {
      break;
    }
    splitPath.push(cursor);
    cursor = branch === "first" ? cursor.first : cursor.second;
  }
  const expectedOrientation: DockOrientation = direction === "left" || direction === "right"
    ? "horizontal"
    : "vertical";

  for (let index = splitPath.length - 1; index >= 0; index -= 1) {
    const split = splitPath[index];
    const branch = path[index] ?? "first";
    if (split.orientation !== expectedOrientation) {
      continue;
    }

    if ((direction === "left" || direction === "up") && branch !== "second") {
      continue;
    }
    if ((direction === "right" || direction === "down") && branch !== "first") {
      continue;
    }

    return {
      node: split,
      branch,
      orientation: expectedOrientation,
    };
  }

  return null;
}

function computeSplitDelta(
  orientation: DockOrientation,
  branch: "first" | "second",
  direction: DockDirection,
): number {
  if (orientation === "horizontal") {
    if (direction === "left" && branch === "second") {
      return RESIZE_STEP;
    }
    if (direction === "right" && branch === "first") {
      return -RESIZE_STEP;
    }
    return 0;
  }

  if (direction === "up" && branch === "second") {
    return RESIZE_STEP;
  }
  if (direction === "down" && branch === "first") {
    return -RESIZE_STEP;
  }

  return 0;
}

function collectStacks(node: DockNode, path: ReadonlyArray<"first" | "second"> = []): StackRef[] {
  if (node.kind === "stack") {
    return [{ stack: node, path }];
  }

  return [
    ...collectStacks(node.first, [...path, "first"]),
    ...collectStacks(node.second, [...path, "second"]),
  ];
}

function findStackByTabId(root: DockNode | null, tabId: string): StackRef | null {
  if (!root) {
    return null;
  }
  return collectStacks(root).find((entry) => entry.stack.tabIds.includes(tabId)) ?? null;
}

function findStackById(root: DockNode, stackId: string): StackRef | null {
  return collectStacks(root).find((entry) => entry.stack.id === stackId) ?? null;
}
