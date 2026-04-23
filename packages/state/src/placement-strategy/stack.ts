import { cloneDockNode, findActiveOrFirstStack, hasTabInDockNode } from "../dock-tree-helpers.js";
import type { DockNode, DockStackNode, DockTreeState } from "../dock-tree-types.js";
import type { PlacementContext, PlacementResult, TabPlacementStrategy } from "./types.js";

export function createStackPlacementStrategy(): TabPlacementStrategy {
  return {
    id: "stack",

    place(ctx: PlacementContext): PlacementResult {
      const { tabId, tree } = ctx;

      // No tree — create initial stack
      if (!tree.root) {
        const stack: DockStackNode = {
          kind: "stack",
          id: tabId,
          tabIds: [tabId],
          activeTabId: tabId,
          navHistory: { back: [], forward: [] },
        };
        return { tree: { root: stack }, targetStackId: stack.id };
      }

      // Tab already in tree — no-op
      if (hasTabInDockNode(tree.root, tabId)) {
        const target = findActiveOrFirstStack(tree.root);
        return { tree, targetStackId: target?.id ?? tabId };
      }

      const nextRoot = cloneDockNode(tree.root);
      if (!nextRoot) {
        const stack: DockStackNode = {
          kind: "stack",
          id: tabId,
          tabIds: [tabId],
          activeTabId: tabId,
          navHistory: { back: [], forward: [] },
        };
        return { tree: { root: stack }, targetStackId: stack.id };
      }

      const target = findActiveOrFirstStack(nextRoot);
      if (!target) {
        const stack: DockStackNode = {
          kind: "stack",
          id: tabId,
          tabIds: [tabId],
          activeTabId: tabId,
          navHistory: { back: [], forward: [] },
        };
        return { tree: { root: stack }, targetStackId: stack.id };
      }

      // Push current active tab to back history, clear forward
      const history = target.navHistory ?? { back: [], forward: [] };
      const newBack = target.activeTabId ? [...history.back, target.activeTabId] : [...history.back];

      target.tabIds = target.tabIds.includes(tabId) ? [...target.tabIds] : [...target.tabIds, tabId];
      target.activeTabId = tabId;
      target.navHistory = { back: newBack, forward: [] };

      return { tree: { root: nextRoot }, targetStackId: target.id };
    },

    navigateBack(stackId: string, tree: DockTreeState): { tree: DockTreeState; activatedTabId?: string } | null {
      if (!tree.root) {
        return null;
      }

      const nextRoot = cloneDockNode(tree.root);
      if (!nextRoot) {
        return null;
      }

      const stack = findStackById(nextRoot, stackId);
      if (!stack || !stack.navHistory || stack.navHistory.back.length === 0) {
        return null;
      }

      const backTab = stack.navHistory.back[stack.navHistory.back.length - 1]!;
      const currentActive = stack.activeTabId;

      stack.navHistory = {
        back: stack.navHistory.back.slice(0, -1),
        forward: currentActive ? [currentActive, ...stack.navHistory.forward] : [...stack.navHistory.forward],
      };
      stack.activeTabId = backTab;

      return { tree: { root: nextRoot }, activatedTabId: backTab };
    },

    navigateForward(stackId: string, tree: DockTreeState): { tree: DockTreeState; activatedTabId?: string } | null {
      if (!tree.root) {
        return null;
      }

      const nextRoot = cloneDockNode(tree.root);
      if (!nextRoot) {
        return null;
      }

      const stack = findStackById(nextRoot, stackId);
      if (!stack || !stack.navHistory || stack.navHistory.forward.length === 0) {
        return null;
      }

      const forwardTab = stack.navHistory.forward[0]!;
      const currentActive = stack.activeTabId;

      stack.navHistory = {
        back: currentActive ? [...stack.navHistory.back, currentActive] : [...stack.navHistory.back],
        forward: stack.navHistory.forward.slice(1),
      };
      stack.activeTabId = forwardTab;

      return { tree: { root: nextRoot }, activatedTabId: forwardTab };
    },

    onTabClosed(ctx: { tabId: string; stackId: string; tree: DockTreeState }): DockTreeState {
      if (!ctx.tree.root) {
        return ctx.tree;
      }

      const nextRoot = cloneDockNode(ctx.tree.root);
      if (!nextRoot) {
        return ctx.tree;
      }

      const stack = findStackById(nextRoot, ctx.stackId);
      if (!stack || !stack.navHistory) {
        return { root: nextRoot };
      }

      stack.navHistory = {
        back: stack.navHistory.back.filter((id) => id !== ctx.tabId),
        forward: stack.navHistory.forward.filter((id) => id !== ctx.tabId),
      };

      return { root: nextRoot };
    },
  };
}

function findStackById(node: DockNode, stackId: string): DockStackNode | null {
  if (node.kind === "stack") {
    return node.id === stackId ? node : null;
  }
  return findStackById(node.first, stackId) ?? findStackById(node.second, stackId);
}
