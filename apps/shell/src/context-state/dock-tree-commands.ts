import { moveTabToGroup, moveTabInDockTree, setActiveTab } from "./tabs-groups.js";
import { setDockSplitRatioById, readDockSplitRatio } from "./dock-tree.js";
import {
  resolveDirectionalTargetTabId,
  resolveNearestDirectionalSplit,
  resolveTabStack,
  swapTabsInDockTree,
} from "./dock-tree-directional.js";
import type { DockDirection } from "./dock-tree-types.js";
import type { ShellContextState } from "./types.js";

const DEFAULT_RESIZE_DELTA = 0.05;

export function focusActiveTabInDirection(state: ShellContextState, direction: DockDirection): ShellContextState {
  if (!state.activeTabId) {
    return state;
  }

  const targetTabId = resolveDirectionalTargetTabId(state.dockTree, state.activeTabId, direction);
  if (!targetTabId || targetTabId === state.activeTabId) {
    return state;
  }

  return setActiveTab(state, targetTabId);
}

export function moveActiveTabInDirection(state: ShellContextState, direction: DockDirection): ShellContextState {
  if (!state.activeTabId) {
    return state;
  }

  const targetTabId = resolveDirectionalTargetTabId(state.dockTree, state.activeTabId, direction);
  if (!targetTabId || targetTabId === state.activeTabId) {
    return state;
  }

  return moveTabInDockTree(state, {
    tabId: state.activeTabId,
    targetTabId,
    zone: directionToDropZone(direction),
  });
}

export function swapActiveTabInDirection(state: ShellContextState, direction: DockDirection): ShellContextState {
  if (!state.activeTabId) {
    return state;
  }

  const targetTabId = resolveDirectionalTargetTabId(state.dockTree, state.activeTabId, direction);
  if (!targetTabId || targetTabId === state.activeTabId) {
    return state;
  }

  const nextDockTree = swapTabsInDockTree(state.dockTree, state.activeTabId, targetTabId);
  if (nextDockTree === state.dockTree) {
    return state;
  }

  return {
    ...state,
    dockTree: nextDockTree,
    activeTabId: state.activeTabId,
  };
}

export function resizeNearestSplitInDirection(
  state: ShellContextState,
  input: { direction: DockDirection; delta?: number },
): ShellContextState {
  if (!state.activeTabId) {
    return state;
  }

  const split = resolveNearestDirectionalSplit(state.dockTree, state.activeTabId, input.direction);
  if (!split) {
    return state;
  }

  const delta = resolveResizeDelta(input.delta);
  if (delta <= 0) {
    return state;
  }

  const sign = resolveResizeSign(split.branch, input.direction);
  const nextRatio = readDockSplitRatio({ ratio: split.ratio }) + (delta * sign);
  const nextDockTree = setDockSplitRatioById(state.dockTree, split.splitId, nextRatio);
  if (nextDockTree === state.dockTree) {
    return state;
  }

  return {
    ...state,
    dockTree: nextDockTree,
  };
}

export function focusAdjacentTabInActiveStack(
  state: ShellContextState,
  direction: "next" | "previous",
): ShellContextState {
  if (!state.activeTabId) {
    return state;
  }

  const stack = resolveTabStack(state.dockTree, state.activeTabId);
  if (!stack || stack.tabIds.length < 2) {
    return state;
  }

  const activeIndex = stack.tabIds.indexOf(state.activeTabId);
  if (activeIndex < 0) {
    return state;
  }

  const step = direction === "next" ? 1 : -1;
  const nextIndex = (activeIndex + step + stack.tabIds.length) % stack.tabIds.length;
  const nextTabId = stack.tabIds[nextIndex];
  if (!nextTabId) {
    return state;
  }

  return setActiveTab(state, nextTabId);
}

export function moveActiveTabToDirectionalGroup(
  state: ShellContextState,
  direction: DockDirection,
): ShellContextState {
  if (!state.activeTabId) {
    return state;
  }

  const targetTabId = resolveDirectionalTargetTabId(state.dockTree, state.activeTabId, direction);
  if (!targetTabId) {
    return state;
  }

  const activeTab = state.tabs[state.activeTabId];
  const targetTab = state.tabs[targetTabId];
  if (!activeTab || !targetTab || activeTab.groupId === targetTab.groupId) {
    return state;
  }

  return moveTabToGroup(state, {
    tabId: activeTab.id,
    targetGroupId: targetTab.groupId,
    targetGroupColor: state.groups[targetTab.groupId]?.color,
  });
}

function directionToDropZone(direction: DockDirection): "left" | "right" | "top" | "bottom" {
  if (direction === "left") {
    return "left";
  }
  if (direction === "right") {
    return "right";
  }
  return direction === "up" ? "top" : "bottom";
}

function resolveResizeDelta(delta: number | undefined): number {
  if (typeof delta !== "number" || !Number.isFinite(delta)) {
    return DEFAULT_RESIZE_DELTA;
  }

  return Math.abs(delta);
}

function resolveResizeSign(branch: "first" | "second", direction: DockDirection): 1 | -1 {
  if (branch === "first") {
    return direction === "right" || direction === "down" ? 1 : -1;
  }

  return direction === "right" || direction === "down" ? -1 : 1;
}
