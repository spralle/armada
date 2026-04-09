import {
  cloneDockNode,
  collapseDockNode,
  createUniqueNodeId,
} from "./dock-tree-helpers.js";
import { ensureTabRegisteredInDockTree, removeTabFromDockTree } from "./dock-tree-register-remove.js";
import type {
  DockDropZone,
  DockNode,
  DockOrientation,
  DockStackNode,
  DockTabDropInput,
  DockTreeState,
} from "./dock-tree-types.js";

type DockPathSegment = "first" | "second";

interface DockLocateResult {
  stack: DockStackNode;
  path: DockPathSegment[];
}

export function applyDockTabDrop(tree: DockTreeState, input: DockTabDropInput): DockTreeState {
  if (input.tabId === input.targetTabId && input.zone === "center") {
    return tree;
  }

  const sourceTarget = locateStackByTabId(tree.root, input.targetTabId);
  const removed = removeTabFromDockTree(tree, input.tabId);
  const withoutMovedRoot = cloneDockNode(removed.root);
  const target = locateStackByTabId(withoutMovedRoot, input.targetTabId)
    ?? resolveSelfDropTarget(withoutMovedRoot, sourceTarget, input);
  if (!target) {
    return ensureTabRegisteredInDockTree(removed, input.tabId);
  }

  if (input.zone === "center") {
    const insertedRoot = insertTabInStack(withoutMovedRoot, target, input.tabId, input.targetTabId);
    return {
      root: collapseDockNode(insertedRoot),
    };
  }

  const splitBase = `split:${target.stack.id}:${input.zone}:${input.tabId}`;
  const splitId = createUniqueNodeId(withoutMovedRoot, splitBase);
  const newStackId = createUniqueNodeId(withoutMovedRoot, `stack:${input.tabId}:drop`);
  const movedStack: DockStackNode = {
    kind: "stack",
    id: newStackId,
    tabIds: [input.tabId],
    activeTabId: input.tabId,
  };
  const orientation = zoneToOrientation(input.zone);
  const split = createSplitNode(splitId, orientation, target.stack, movedStack, input.zone);
  const replacedRoot = replaceNodeAtPath(withoutMovedRoot, target.path, split);
  return {
    root: collapseDockNode(replacedRoot),
  };
}

function createSplitNode(
  id: string,
  orientation: DockOrientation,
  targetStack: DockStackNode,
  movedStack: DockStackNode,
  zone: Exclude<DockDropZone, "center">,
): DockNode {
  const movedFirst = zone === "left" || zone === "top";
  return {
    kind: "split",
    id,
    orientation,
    first: movedFirst ? movedStack : targetStack,
    second: movedFirst ? targetStack : movedStack,
  };
}

function zoneToOrientation(zone: Exclude<DockDropZone, "center">): DockOrientation {
  if (zone === "left" || zone === "right") {
    return "horizontal";
  }
  return "vertical";
}

function locateStackByTabId(node: DockNode | null, targetTabId: string): DockLocateResult | null {
  if (!node) {
    return null;
  }

  if (node.kind === "stack") {
    return node.tabIds.includes(targetTabId)
      ? { stack: node, path: [] }
      : null;
  }

  const inFirst = locateStackByTabId(node.first, targetTabId);
  if (inFirst) {
    return {
      stack: inFirst.stack,
      path: ["first", ...inFirst.path],
    };
  }

  const inSecond = locateStackByTabId(node.second, targetTabId);
  if (!inSecond) {
    return null;
  }

  return {
    stack: inSecond.stack,
    path: ["second", ...inSecond.path],
  };
}

function resolveSelfDropTarget(
  root: DockNode | null,
  sourceTarget: DockLocateResult | null,
  input: DockTabDropInput,
): DockLocateResult | null {
  if (input.zone === "center" || input.tabId !== input.targetTabId || !sourceTarget) {
    return null;
  }

  const stackAtOriginalPath = locateStackAtPath(root, sourceTarget.path);
  if (!stackAtOriginalPath) {
    return null;
  }

  return {
    stack: stackAtOriginalPath,
    path: sourceTarget.path,
  };
}

function locateStackAtPath(node: DockNode | null, path: DockPathSegment[]): DockStackNode | null {
  if (!node) {
    return null;
  }

  if (path.length === 0) {
    return node.kind === "stack" ? node : null;
  }

  if (node.kind === "stack") {
    return null;
  }

  const [segment, ...rest] = path;
  return locateStackAtPath(segment === "first" ? node.first : node.second, rest);
}

function insertTabInStack(
  root: DockNode | null,
  target: DockLocateResult,
  tabId: string,
  targetTabId: string,
): DockNode | null {
  const stack = target.stack;
  const baseIds = stack.tabIds.filter((id) => id !== tabId);
  const targetIndex = baseIds.indexOf(targetTabId);
  const insertIndex = targetIndex >= 0 ? targetIndex + 1 : baseIds.length;
  const nextTabIds = [...baseIds.slice(0, insertIndex), tabId, ...baseIds.slice(insertIndex)];
  const nextStack: DockStackNode = {
    ...stack,
    tabIds: nextTabIds,
    activeTabId: tabId,
  };
  return replaceNodeAtPath(root, target.path, nextStack);
}

function replaceNodeAtPath(root: DockNode | null, path: DockPathSegment[], replacement: DockNode): DockNode | null {
  if (!root) {
    return replacement;
  }

  if (path.length === 0) {
    return replacement;
  }

  if (root.kind === "stack") {
    return root;
  }

  const [segment, ...rest] = path;
  if (segment === "first") {
    return {
      ...root,
      first: replaceNodeAtPath(root.first, rest, replacement) ?? root.first,
    };
  }

  return {
    ...root,
    second: replaceNodeAtPath(root.second, rest, replacement) ?? root.second,
  };
}
