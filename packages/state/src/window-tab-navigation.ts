import { findActiveOrFirstStack } from "./dock-tree-helpers.js";
import { reorderTabInStack } from "./dock-tree-window-actions.js";
import type { PlacementStrategyRegistry } from "./placement-strategy/registry.js";
import type { PlacementConfig } from "./placement-strategy/types.js";
import { setActiveTab } from "./tabs-groups.js";
import type { ShellContextState } from "./types.js";
import { findStackByTabId } from "./window-spatial-commands.js";

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

export function cycleTabGroup(state: ShellContextState, step: 1 | -1): { state: ShellContextState; changed: boolean } {
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

export function reorderActiveTabInStack(
  state: ShellContextState,
  direction: "next" | "previous",
): { state: ShellContextState; changed: boolean } {
  const activeTabId = state.activeTabId;
  if (!activeTabId) {
    return { state, changed: false };
  }

  const result = reorderTabInStack(state.dockTree, activeTabId, direction);
  if (!result.changed) {
    return { state, changed: false };
  }

  return {
    state: {
      ...state,
      dockTree: result.tree,
    },
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
