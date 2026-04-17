import {
  focusDockStackInDirection,
  moveActiveTabInDirection,
  swapActiveTabInDirection,
} from "./dock-tree-window-actions.js";
import { resizeNearestSplitInDirection } from "./dock-tree-commands.js";
import { readDockSplitRatio } from "./dock-tree.js";
import { setActiveTab } from "./tabs-groups.js";
import type { DockNode, DockStackNode } from "./dock-tree-types.js";
import type { ShellContextState } from "./types.js";
import type { PlacementStrategyRegistry } from "./placement-strategy-registry.js";
import type { PlacementConfig } from "./placement-strategy-types.js";
import { findActiveOrFirstStack } from "./dock-tree-helpers.js";

type DockDirection = "left" | "right" | "up" | "down";

export function focusTabInDirection(
  state: ShellContextState,
  direction: DockDirection,
): { state: ShellContextState; changed: boolean } {
  const activeTabId = state.activeTabId;
  if (!activeTabId) {
    return { state, changed: false };
  }

  const focused = focusDockStackInDirection(state.dockTree, activeTabId, direction);
  if (!focused.changed || !focused.activeTabId || focused.activeTabId === activeTabId) {
    return { state, changed: false };
  }

  return {
    state: setActiveTab(state, focused.activeTabId),
    changed: true,
  };
}

export function moveTabInDirection(
  state: ShellContextState,
  direction: DockDirection,
): { state: ShellContextState; changed: boolean } {
  const activeTabId = state.activeTabId;
  if (!activeTabId) {
    return { state, changed: false };
  }

  const moved = moveActiveTabInDirection(state.dockTree, activeTabId, direction);
  if (!moved.changed) {
    return { state, changed: false };
  }

  return {
    state: {
      ...state,
      dockTree: moved.tree,
      activeTabId,
    },
    changed: true,
  };
}

export function swapTabInDirection(
  state: ShellContextState,
  direction: DockDirection,
): { state: ShellContextState; changed: boolean } {
  const activeTabId = state.activeTabId;
  if (!activeTabId) {
    return { state, changed: false };
  }

  const swapped = swapActiveTabInDirection(state.dockTree, activeTabId, direction);
  if (!swapped.changed) {
    return { state, changed: false };
  }

  return {
    state: {
      ...state,
      dockTree: swapped.tree,
      activeTabId,
    },
    changed: true,
  };
}

export function resizeInDirection(
  state: ShellContextState,
  direction: DockDirection,
): { state: ShellContextState; changed: boolean } {
  const activeTabId = state.activeTabId;
  if (!activeTabId) {
    return { state, changed: false };
  }

  const nextState = resizeNearestSplitInDirection(state, { direction });
  if (nextState === state) {
    return { state, changed: false };
  }

  return {
    state: nextState,
    changed: true,
  };
}

export function cycleTabInActiveStack(
  state: ShellContextState,
  step: 1 | -1,
): { state: ShellContextState; changed: boolean } {
  const activeTabId = state.activeTabId;
  if (!activeTabId) {
    return { state, changed: false };
  }

  const stack = findStackByTabId(state.dockTree.root, activeTabId);
  if (!stack || stack.tabIds.length <= 1) {
    return { state, changed: false };
  }

  const currentIndex = stack.tabIds.indexOf(activeTabId);
  if (currentIndex < 0) {
    return { state, changed: false };
  }

  const nextIndex = (currentIndex + step + stack.tabIds.length) % stack.tabIds.length;
  const nextTabId = stack.tabIds[nextIndex];
  if (!nextTabId || nextTabId === activeTabId) {
    return { state, changed: false };
  }

  return {
    state: setActiveTab(state, nextTabId),
    changed: true,
  };
}

export function cycleTabGroup(
  state: ShellContextState,
  step: 1 | -1,
): { state: ShellContextState; changed: boolean } {
  const activeTabId = state.activeTabId;
  const activeGroupId = activeTabId ? state.tabs[activeTabId]?.groupId : null;
  if (!activeGroupId) {
    return { state, changed: false };
  }

  const orderedGroupIds = state.tabOrder
    .map((tabId) => state.tabs[tabId]?.groupId)
    .filter((groupId): groupId is string => Boolean(groupId))
    .filter((groupId, index, all) => all.indexOf(groupId) === index);
  if (orderedGroupIds.length <= 1) {
    return { state, changed: false };
  }

  const groupIndex = orderedGroupIds.indexOf(activeGroupId);
  if (groupIndex < 0) {
    return { state, changed: false };
  }

  const nextGroupId = orderedGroupIds[(groupIndex + step + orderedGroupIds.length) % orderedGroupIds.length];
  const nextTabId = state.tabOrder.find((tabId) => state.tabs[tabId]?.groupId === nextGroupId);
  if (!nextTabId || nextTabId === activeTabId) {
    return { state, changed: false };
  }

  return {
    state: setActiveTab(state, nextTabId),
    changed: true,
  };
}

function findStackByTabId(root: DockNode | null, tabId: string): DockStackNode | null {
  if (!root) {
    return null;
  }

  if (root.kind === "stack") {
    return root.tabIds.includes(tabId) ? root : null;
  }

  return findStackByTabId(root.first, tabId) ?? findStackByTabId(root.second, tabId);
}

export function equalizeSplits(
  state: ShellContextState,
): { state: ShellContextState; changed: boolean } {
  if (!state.dockTree.root) {
    return { state, changed: false };
  }

  const result = resetSplitRatios(state.dockTree.root);
  if (!result.changed) {
    return { state, changed: false };
  }

  return {
    state: { ...state, dockTree: { ...state.dockTree, root: result.node } },
    changed: true,
  };
}

function resetSplitRatios(node: DockNode): { node: DockNode; changed: boolean } {
  if (node.kind === "stack") {
    return { node, changed: false };
  }

  const currentRatio = readDockSplitRatio(node);
  const ratioChanged = currentRatio !== 0.5;

  const first = resetSplitRatios(node.first);
  const second = resetSplitRatios(node.second);

  if (!ratioChanged && !first.changed && !second.changed) {
    return { node, changed: false };
  }

  return {
    node: {
      ...node,
      ratio: 0.5,
      first: first.node,
      second: second.node,
    },
    changed: true,
  };
}

export function gotoTabByIndex(
  state: ShellContextState,
  index: number,
): { state: ShellContextState; changed: boolean } {
  const activeTabId = state.activeTabId;
  if (!activeTabId) {
    return { state, changed: false };
  }

  const stack = findStackByTabId(state.dockTree.root, activeTabId);
  if (!stack) {
    return { state, changed: false };
  }

  const targetTabId = stack.tabIds[index - 1];
  if (!targetTabId || targetTabId === activeTabId) {
    return { state, changed: false };
  }

  return {
    state: setActiveTab(state, targetTabId),
    changed: true,
  };
}

export function navigateBackInActiveStack(
  state: ShellContextState,
  placementRegistry: PlacementStrategyRegistry,
  placementConfig: PlacementConfig,
): { state: ShellContextState; changed: boolean } {
  const strategy = placementRegistry.getActive(placementConfig);
  if (!strategy.navigateBack) {
    return { state, changed: false };
  }
  const activeStack = state.dockTree.root ? findActiveOrFirstStack(state.dockTree.root) : null;
  if (!activeStack) {
    return { state, changed: false };
  }
  const result = strategy.navigateBack(activeStack.id, state.dockTree);
  if (!result) {
    return { state, changed: false };
  }
  return {
    state: {
      ...state,
      dockTree: result.tree,
      activeTabId: result.activatedTabId ?? state.activeTabId,
    },
    changed: true,
  };
}

export function navigateForwardInActiveStack(
  state: ShellContextState,
  placementRegistry: PlacementStrategyRegistry,
  placementConfig: PlacementConfig,
): { state: ShellContextState; changed: boolean } {
  const strategy = placementRegistry.getActive(placementConfig);
  if (!strategy.navigateForward) {
    return { state, changed: false };
  }
  const activeStack = state.dockTree.root ? findActiveOrFirstStack(state.dockTree.root) : null;
  if (!activeStack) {
    return { state, changed: false };
  }
  const result = strategy.navigateForward(activeStack.id, state.dockTree);
  if (!result) {
    return { state, changed: false };
  }
  return {
    state: {
      ...state,
      dockTree: result.tree,
      activeTabId: result.activatedTabId ?? state.activeTabId,
    },
    changed: true,
  };
}
