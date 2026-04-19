import {
  deriveDeterministicActiveTabId,
} from "./dock-tree.js";
import { cloneDockNode, collapseDockNode, createUniqueNodeId, replaceNodeAtPath } from "./dock-tree-helpers.js";
import type { DockNode, DockOrientation, DockStackNode, DockTreeState } from "./dock-tree-types.js";
import {
  collectSplitPath,
  collectStacks,
  directionalDistance,
  findStackById,
  findStackByTabId,
} from "./dock-tree-window-actions-helpers.js";

type DockDirection = "left" | "right" | "up" | "down";

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

export function reorderTabInStack(
  tree: DockTreeState,
  tabId: string,
  direction: "next" | "previous",
): { tree: DockTreeState; changed: boolean } {
  const source = findStackByTabId(tree.root, tabId);
  if (!source || source.stack.tabIds.length <= 1) {
    return { tree, changed: false };
  }

  const currentIndex = source.stack.tabIds.indexOf(tabId);
  if (currentIndex < 0) {
    return { tree, changed: false };
  }

  const targetIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
  if (targetIndex < 0 || targetIndex >= source.stack.tabIds.length) {
    return { tree, changed: false };
  }

  const nextRoot = cloneDockNode(tree.root);
  if (!nextRoot) {
    return { tree, changed: false };
  }

  const nextSource = findStackByTabId(nextRoot, tabId);
  if (!nextSource) {
    return { tree, changed: false };
  }

  const temp = nextSource.stack.tabIds[currentIndex]!;
  nextSource.stack.tabIds[currentIndex] = nextSource.stack.tabIds[targetIndex]!;
  nextSource.stack.tabIds[targetIndex] = temp;

  return { tree: { root: nextRoot }, changed: true };
}

export function detachActiveTabInDirection(
  tree: DockTreeState,
  activeTabId: string,
  direction: DockDirection,
): { tree: DockTreeState; activeTabId: string; changed: boolean } {
  const source = findStackByTabId(tree.root, activeTabId);
  if (!source) {
    return { tree, activeTabId, changed: false };
  }

  if (source.stack.tabIds.length <= 1) {
    return { tree, activeTabId, changed: false };
  }

  const clonedRoot = cloneDockNode(tree.root);
  if (!clonedRoot) {
    return { tree, activeTabId, changed: false };
  }

  const clonedSource = findStackByTabId(clonedRoot, activeTabId);
  if (!clonedSource) {
    return { tree, activeTabId, changed: false };
  }

  clonedSource.stack.tabIds = clonedSource.stack.tabIds.filter((id) => id !== activeTabId);
  clonedSource.stack.activeTabId = clonedSource.stack.tabIds[0] ?? null;

  const newStack: DockStackNode = {
    kind: "stack",
    id: createUniqueNodeId(clonedRoot, "stack"),
    tabIds: [activeTabId],
    activeTabId,
  };

  const orientation = direction === "left" || direction === "right" ? "horizontal" as const : "vertical" as const;
  const movedFirst = direction === "left" || direction === "up";
  const splitNode: DockNode = {
    kind: "split",
    id: createUniqueNodeId(clonedRoot, "split"),
    orientation,
    ratio: 0.5,
    first: movedFirst ? newStack : clonedSource.stack,
    second: movedFirst ? clonedSource.stack : newStack,
  };

  const result = replaceNodeAtPath(clonedRoot, clonedSource.path, splitNode);
  return {
    tree: { root: collapseDockNode(result) },
    activeTabId,
    changed: true,
  };
}

export function explodeStack(
  tree: DockTreeState,
  activeTabId: string,
): { tree: DockTreeState; activeTabId: string; changed: boolean } {
  const source = findStackByTabId(tree.root, activeTabId);
  if (!source || source.stack.tabIds.length <= 1) {
    return { tree, activeTabId, changed: false };
  }

  const clonedRoot = cloneDockNode(tree.root);
  if (!clonedRoot) {
    return { tree, activeTabId, changed: false };
  }

  const { tabIds } = source.stack;
  const orderedTabs = [activeTabId, ...tabIds.filter((id) => id !== activeTabId)];
  const usedIds = new Set<string>();

  const stacks: DockStackNode[] = orderedTabs.map((tabId) => {
    const id = uniqueIdAvoiding(clonedRoot, "stack", usedIds);
    usedIds.add(id);
    return { kind: "stack", id, tabIds: [tabId], activeTabId: tabId };
  });

  const subtree = buildDwindleChain(clonedRoot, stacks, usedIds);
  const result = replaceNodeAtPath(clonedRoot, source.path, subtree);

  return {
    tree: { root: result },
    activeTabId,
    changed: true,
  };
}

export function absorbNeighborStackInDirection(
  tree: DockTreeState,
  activeTabId: string,
  direction: DockDirection,
): { tree: DockTreeState; activeTabId: string; changed: boolean } {
  const source = findStackByTabId(tree.root, activeTabId);
  if (!source) {
    return { tree, activeTabId, changed: false };
  }

  const target = findDirectionalFocusTarget(tree.root, source.path, source.stack.id, direction);
  if (!target || target.stack.id === source.stack.id) {
    return { tree, activeTabId, changed: false };
  }

  const nextRoot = cloneDockNode(tree.root);
  if (!nextRoot) {
    return { tree, activeTabId, changed: false };
  }

  const clonedSource = findStackById(nextRoot, source.stack.id);
  const clonedTarget = findStackById(nextRoot, target.stack.id);
  if (!clonedSource || !clonedTarget) {
    return { tree, activeTabId, changed: false };
  }

  clonedSource.stack.tabIds = [...clonedSource.stack.tabIds, ...clonedTarget.stack.tabIds];
  clonedTarget.stack.tabIds = [];

  const collapsed = collapseDockNode(nextRoot);

  return {
    tree: { root: collapsed },
    activeTabId,
    changed: true,
  };
}

function uniqueIdAvoiding(root: DockNode, base: string, extra: Set<string>): string {
  let id = createUniqueNodeId(root, base);
  let suffix = Number(id.split(":").pop());
  while (extra.has(id)) {
    suffix += 1;
    id = `${base}:${suffix}`;
  }
  return id;
}

function buildDwindleChain(root: DockNode, stacks: DockStackNode[], usedIds: Set<string>): DockNode {
  if (stacks.length === 1) {
    return stacks[0]!;
  }

  let node: DockNode = stacks[stacks.length - 1]!;
  for (let i = stacks.length - 2; i >= 0; i--) {
    const orientation: DockOrientation = i % 2 === 0 ? "horizontal" : "vertical";
    const id = uniqueIdAvoiding(root, "split", usedIds);
    usedIds.add(id);
    node = {
      kind: "split",
      id,
      orientation,
      ratio: 0.5,
      first: stacks[i]!,
      second: node,
    };
  }

  return node;
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
