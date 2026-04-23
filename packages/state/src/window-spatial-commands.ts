import {
  absorbNeighborStackInDirection,
  detachActiveTabInDirection,
  explodeStack,
  focusDockStackInDirection,
  moveActiveTabInDirection,
  swapActiveTabInDirection,
} from "./dock-tree-window-actions.js";
import { resizeNearestSplitInDirection } from "./dock-tree-commands.js";
import { readDockSplitRatio } from "./dock-tree.js";
import { setActiveTab } from "./tabs-groups.js";
import type { DockNode, DockStackNode } from "./dock-tree-types.js";
import type { ShellContextState } from "./types.js";

type DockDirection = "left" | "right" | "up" | "down";

export function findStackByTabId(root: DockNode | null, tabId: string): DockStackNode | null {
  if (!root) {
    return null;
  }

  if (root.kind === "stack") {
    return root.tabIds.includes(tabId) ? root : null;
  }

  return findStackByTabId(root.first, tabId) ?? findStackByTabId(root.second, tabId);
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
  if (moved.changed) {
    return {
      state: { ...state, dockTree: moved.tree, activeTabId },
      changed: true,
    };
  }

  // No neighbor in this direction — detach tab into new pane if multi-tab stack
  const sourceStack = findStackByTabId(state.dockTree.root, activeTabId);
  if (!sourceStack || sourceStack.tabIds.length <= 1) {
    return { state, changed: false };
  }

  const detached = detachActiveTabInDirection(state.dockTree, activeTabId, direction);
  if (!detached.changed) {
    return { state, changed: false };
  }

  return {
    state: { ...state, dockTree: detached.tree, activeTabId },
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

export function detachTabInDirection(
  state: ShellContextState,
  direction: DockDirection,
): { state: ShellContextState; changed: boolean } {
  const activeTabId = state.activeTabId;
  if (!activeTabId) {
    return { state, changed: false };
  }

  const detached = detachActiveTabInDirection(state.dockTree, activeTabId, direction);
  if (!detached.changed) {
    return { state, changed: false };
  }

  return {
    state: {
      ...state,
      dockTree: detached.tree,
      activeTabId,
    },
    changed: true,
  };
}

export function absorbStackInDirection(
  state: ShellContextState,
  direction: DockDirection,
): { state: ShellContextState; changed: boolean } {
  const activeTabId = state.activeTabId;
  if (!activeTabId) {
    return { state, changed: false };
  }

  const absorbed = absorbNeighborStackInDirection(state.dockTree, activeTabId, direction);
  if (!absorbed.changed) {
    return { state, changed: false };
  }

  return {
    state: {
      ...state,
      dockTree: absorbed.tree,
      activeTabId,
    },
    changed: true,
  };
}

export function explodeActiveStack(
  state: ShellContextState,
): { state: ShellContextState; changed: boolean } {
  const activeTabId = state.activeTabId;
  if (!activeTabId) {
    return { state, changed: false };
  }

  const exploded = explodeStack(state.dockTree, activeTabId);
  if (!exploded.changed) {
    return { state, changed: false };
  }

  return {
    state: {
      ...state,
      dockTree: exploded.tree,
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
