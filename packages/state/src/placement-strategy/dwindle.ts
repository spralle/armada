import {
  cloneDockNode,
  createUniqueNodeId,
  findActiveOrFirstStack,
  hasTabInDockNode,
} from "../dock-tree-helpers.js";
import type { DockNode, DockOrientation, DockStackNode } from "../dock-tree-types.js";
import type {
  DwindleSplitDirection,
  PlacementContext,
  PlacementResult,
  TabPlacementStrategy,
} from "./types.js";

export function createDwindlePlacementStrategy(): TabPlacementStrategy {
  return {
    id: "dwindle",

    place(ctx: PlacementContext): PlacementResult {
      const { tabId, tree, dwindleDirection = "alternate" } = ctx;

      // No tree — create initial stack
      if (!tree.root) {
        const stack: DockStackNode = { kind: "stack", id: tabId, tabIds: [tabId], activeTabId: tabId };
        return { tree: { root: stack }, targetStackId: stack.id };
      }

      // Tab already in tree — no-op
      if (hasTabInDockNode(tree.root, tabId)) {
        const target = findActiveOrFirstStack(tree.root);
        return { tree, targetStackId: target?.id ?? tabId };
      }

      const nextRoot = cloneDockNode(tree.root);
      if (!nextRoot) {
        const stack: DockStackNode = { kind: "stack", id: tabId, tabIds: [tabId], activeTabId: tabId };
        return { tree: { root: stack }, targetStackId: stack.id };
      }

      // Find active stack and its depth + path
      const located = locateActiveStack(nextRoot, ctx.activeStackId);
      if (!located) {
        const stack: DockStackNode = { kind: "stack", id: tabId, tabIds: [tabId], activeTabId: tabId };
        return { tree: { root: stack }, targetStackId: stack.id };
      }

      const { stack: activeStack, depth, path } = located;

      // Create new stack for the tab
      const newStackId = createUniqueNodeId(nextRoot, `stack:${tabId}:dwindle`);
      const newStack: DockStackNode = {
        kind: "stack",
        id: newStackId,
        tabIds: [tabId],
        activeTabId: tabId,
      };

      // Determine split orientation
      const orientation = resolveOrientation(dwindleDirection, depth);

      // Create split node replacing active stack's position
      const splitId = createUniqueNodeId(nextRoot, `split:${activeStack.id}:dwindle`);
      const splitNode: DockNode = {
        kind: "split",
        id: splitId,
        orientation,
        first: activeStack,
        second: newStack,
      };

      // Replace active stack at its path with the new split
      const newRoot = replaceAtPath(nextRoot, path, splitNode);
      return { tree: { root: newRoot }, targetStackId: newStackId };
    },
  };
}

function resolveOrientation(direction: DwindleSplitDirection, depth: number): DockOrientation {
  switch (direction) {
    case "horizontal":
      return "horizontal";
    case "vertical":
      return "vertical";
    case "alternate":
      return depth % 2 === 0 ? "horizontal" : "vertical";
  }
}

interface LocateResult {
  stack: DockStackNode;
  depth: number;
  path: ("first" | "second")[];
}

function locateActiveStack(node: DockNode, targetStackId?: string, depth = 0): LocateResult | null {
  if (node.kind === "stack") {
    return { stack: node, depth, path: [] };
  }

  const allResults: LocateResult[] = [];
  const inFirst = locateActiveStack(node.first, targetStackId, depth + 1);
  if (inFirst) {
    allResults.push({ ...inFirst, path: ["first", ...inFirst.path] });
  }
  const inSecond = locateActiveStack(node.second, targetStackId, depth + 1);
  if (inSecond) {
    allResults.push({ ...inSecond, path: ["second", ...inSecond.path] });
  }

  // Prefer the explicitly targeted stack, then one with an active tab, then first found
  if (targetStackId) {
    const targeted = allResults.find((r) => r.stack.id === targetStackId);
    if (targeted) {
      return targeted;
    }
  }

  const active = allResults.find((r) => r.stack.activeTabId && r.stack.tabIds.includes(r.stack.activeTabId));
  return active ?? allResults[0] ?? null;
}

function replaceAtPath(node: DockNode, path: ("first" | "second")[], replacement: DockNode): DockNode {
  if (path.length === 0) {
    return replacement;
  }

  if (node.kind === "stack") {
    return node;
  }

  const [segment, ...rest] = path;
  if (segment === "first") {
    return { ...node, first: replaceAtPath(node.first, rest, replacement) };
  }
  return { ...node, second: replaceAtPath(node.second, rest, replacement) };
}
