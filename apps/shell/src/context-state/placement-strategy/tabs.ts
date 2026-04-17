import { cloneDockNode, findActiveOrFirstStack, hasTabInDockNode } from "../dock-tree-helpers.js";
import type { DockStackNode } from "../dock-tree-types.js";
import type { PlacementContext, PlacementResult, TabPlacementStrategy } from "./types.js";

export function createTabsPlacementStrategy(): TabPlacementStrategy {
  return {
    id: "tabs",

    place(ctx: PlacementContext): PlacementResult {
      const { tabId, tree } = ctx;

      // No tree — create initial stack
      if (!tree.root) {
        const stack: DockStackNode = { kind: "stack", id: tabId, tabIds: [tabId], activeTabId: tabId };
        return { tree: { root: stack }, targetStackId: stack.id };
      }

      // Tab already exists in tree — no-op
      if (hasTabInDockNode(tree.root, tabId)) {
        const target = findActiveOrFirstStack(tree.root);
        return { tree, targetStackId: target?.id ?? tabId };
      }

      // Clone and find target stack
      const nextRoot = cloneDockNode(tree.root);
      if (!nextRoot) {
        const stack: DockStackNode = { kind: "stack", id: tabId, tabIds: [tabId], activeTabId: tabId };
        return { tree: { root: stack }, targetStackId: stack.id };
      }

      const target = findActiveOrFirstStack(nextRoot);
      if (!target) {
        const stack: DockStackNode = { kind: "stack", id: tabId, tabIds: [tabId], activeTabId: tabId };
        return { tree: { root: stack }, targetStackId: stack.id };
      }

      target.tabIds = [...target.tabIds, tabId];
      target.activeTabId = target.activeTabId ?? tabId;
      return { tree: { root: nextRoot }, targetStackId: target.id };
    },
  };
}
