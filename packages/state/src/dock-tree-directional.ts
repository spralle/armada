import { cloneDockNode } from "./dock-tree-helpers.js";
import type {
  DockDirection,
  DockNode,
  DockOrientation,
  DockSplitNode,
  DockStackNode,
  DockTreeState,
} from "./dock-tree-types.js";

type DockBranch = "first" | "second";

interface DockAncestor {
  split: DockSplitNode;
  branch: DockBranch;
}

interface DockStackLocation {
  stack: DockStackNode;
  ancestors: DockAncestor[];
}

export function resolveDirectionalTargetTabId(
  tree: DockTreeState,
  sourceTabId: string,
  direction: DockDirection,
): string | null {
  const targetStack = resolveDirectionalNeighborStack(tree.root, sourceTabId, direction);
  if (!targetStack) {
    return null;
  }

  return readDeterministicStackTabId(targetStack);
}

export function resolveTabStack(tree: DockTreeState, tabId: string): DockStackNode | null {
  return locateStackByTabId(tree.root, tabId)?.stack ?? null;
}

export function resolveNearestDirectionalSplit(
  tree: DockTreeState,
  sourceTabId: string,
  direction: DockDirection,
): { splitId: string; branch: DockBranch; ratio: number | undefined } | null {
  const source = locateStackByTabId(tree.root, sourceTabId);
  if (!source) {
    return null;
  }

  for (let index = source.ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = source.ancestors[index];
    if (isOrientationMatch(ancestor.split.orientation, direction)) {
      return {
        splitId: ancestor.split.id,
        branch: ancestor.branch,
        ratio: ancestor.split.ratio,
      };
    }
  }

  return null;
}

export function swapTabsInDockTree(tree: DockTreeState, sourceTabId: string, targetTabId: string): DockTreeState {
  if (!tree.root || sourceTabId === targetTabId) {
    return tree;
  }

  const clonedRoot = cloneDockNode(tree.root);
  if (!clonedRoot) {
    return tree;
  }

  const sourceLocation = locateStackByTabId(clonedRoot, sourceTabId);
  const targetLocation = locateStackByTabId(clonedRoot, targetTabId);
  if (!sourceLocation || !targetLocation || sourceLocation.stack.id === targetLocation.stack.id) {
    return tree;
  }

  const sourceIndex = sourceLocation.stack.tabIds.indexOf(sourceTabId);
  const targetIndex = targetLocation.stack.tabIds.indexOf(targetTabId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return tree;
  }

  sourceLocation.stack.tabIds[sourceIndex] = targetTabId;
  targetLocation.stack.tabIds[targetIndex] = sourceTabId;
  sourceLocation.stack.activeTabId = swapActiveTabId(sourceLocation.stack.activeTabId, sourceTabId, targetTabId);
  targetLocation.stack.activeTabId = swapActiveTabId(targetLocation.stack.activeTabId, sourceTabId, targetTabId);

  return {
    root: clonedRoot,
  };
}

function swapActiveTabId(activeTabId: string | null, sourceTabId: string, targetTabId: string): string | null {
  if (activeTabId === sourceTabId) {
    return targetTabId;
  }
  if (activeTabId === targetTabId) {
    return sourceTabId;
  }
  return activeTabId;
}

function resolveDirectionalNeighborStack(
  root: DockNode | null,
  sourceTabId: string,
  direction: DockDirection,
): DockStackNode | null {
  const source = locateStackByTabId(root, sourceTabId);
  if (!source) {
    return null;
  }

  for (let index = source.ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = source.ancestors[index];
    if (!isOrientationMatch(ancestor.split.orientation, direction)) {
      continue;
    }

    if (!isBranchEligibleForDirection(ancestor.branch, direction)) {
      continue;
    }

    const sibling = ancestor.branch === "first" ? ancestor.split.second : ancestor.split.first;
    const candidate = pickDirectionalBoundaryStack(sibling, direction);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function locateStackByTabId(
  node: DockNode | null,
  tabId: string,
  ancestors: DockAncestor[] = [],
): DockStackLocation | null {
  if (!node) {
    return null;
  }

  if (node.kind === "stack") {
    return node.tabIds.includes(tabId)
      ? {
          stack: node,
          ancestors,
        }
      : null;
  }

  const firstMatch = locateStackByTabId(node.first, tabId, [...ancestors, { split: node, branch: "first" }]);
  if (firstMatch) {
    return firstMatch;
  }

  return locateStackByTabId(node.second, tabId, [...ancestors, { split: node, branch: "second" }]);
}

function pickDirectionalBoundaryStack(node: DockNode, direction: DockDirection): DockStackNode | null {
  if (node.kind === "stack") {
    return node.tabIds.length > 0 ? node : null;
  }

  const [primary, secondary] = prioritizeChildren(node, direction);
  return pickDirectionalBoundaryStack(primary, direction) ?? pickDirectionalBoundaryStack(secondary, direction);
}

function prioritizeChildren(node: DockSplitNode, direction: DockDirection): [DockNode, DockNode] {
  if (direction === "left" && node.orientation === "horizontal") {
    return [node.second, node.first];
  }
  if (direction === "right" && node.orientation === "horizontal") {
    return [node.first, node.second];
  }
  if (direction === "up" && node.orientation === "vertical") {
    return [node.second, node.first];
  }
  if (direction === "down" && node.orientation === "vertical") {
    return [node.first, node.second];
  }

  return [node.first, node.second];
}

function readDeterministicStackTabId(stack: DockStackNode): string | null {
  if (stack.activeTabId && stack.tabIds.includes(stack.activeTabId)) {
    return stack.activeTabId;
  }

  return stack.tabIds[0] ?? null;
}

function isOrientationMatch(orientation: DockOrientation, direction: DockDirection): boolean {
  return direction === "left" || direction === "right" ? orientation === "horizontal" : orientation === "vertical";
}

function isBranchEligibleForDirection(branch: DockBranch, direction: DockDirection): boolean {
  if (direction === "left" || direction === "up") {
    return branch === "second";
  }
  return branch === "first";
}
