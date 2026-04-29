import type { DockNode, DockStackNode } from "./dock-tree-types.js";

export function cloneDockNode(node: DockNode | null): DockNode | null {
  if (!node) {
    return null;
  }

  if (node.kind === "stack") {
    const clone: DockStackNode = {
      kind: "stack",
      id: node.id,
      tabIds: [...node.tabIds],
      activeTabId: node.activeTabId,
    };
    if (node.navHistory) {
      clone.navHistory = {
        back: [...node.navHistory.back],
        forward: [...node.navHistory.forward],
      };
    }
    return clone;
  }

  return {
    kind: "split",
    id: node.id,
    orientation: node.orientation,
    ratio: node.ratio,
    first: cloneDockNode(node.first)!,
    second: cloneDockNode(node.second)!,
  };
}

export function hasTabInDockNode(node: DockNode, tabId: string): boolean {
  if (node.kind === "stack") {
    return node.tabIds.includes(tabId);
  }

  return hasTabInDockNode(node.first, tabId) || hasTabInDockNode(node.second, tabId);
}

export function findActiveOrFirstStack(node: DockNode): DockStackNode | null {
  const stacks = collectStacks(node);
  if (stacks.length === 0) {
    return null;
  }

  const active = stacks.find((stack) => stack.activeTabId && stack.tabIds.includes(stack.activeTabId));
  return active ?? stacks[0] ?? null;
}

export function collapseDockNode(node: DockNode | null): DockNode | null {
  if (!node) {
    return null;
  }

  if (node.kind === "stack") {
    if (node.tabIds.length === 0) {
      return null;
    }

    const activeTabId =
      node.activeTabId && node.tabIds.includes(node.activeTabId) ? node.activeTabId : (node.tabIds[0] ?? null);
    return {
      ...node,
      activeTabId,
    };
  }

  const first = collapseDockNode(node.first);
  const second = collapseDockNode(node.second);
  if (!first && !second) {
    return null;
  }
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }

  return {
    ...node,
    first,
    second,
  };
}

export function createUniqueNodeId(root: DockNode | null, base: string): string {
  if (!root) {
    return `${base}:1`;
  }

  const existing = collectNodeIds(root);
  let index = 1;
  while (existing.has(`${base}:${index}`)) {
    index += 1;
  }
  return `${base}:${index}`;
}

export function deriveDeterministicActiveFromNode(node: DockNode): string | null {
  if (node.kind === "stack") {
    if (node.activeTabId && node.tabIds.includes(node.activeTabId)) {
      return node.activeTabId;
    }
    return node.tabIds[0] ?? null;
  }

  return deriveDeterministicActiveFromNode(node.first) ?? deriveDeterministicActiveFromNode(node.second);
}

function collectStacks(node: DockNode): DockStackNode[] {
  if (node.kind === "stack") {
    return [node];
  }

  return [...collectStacks(node.first), ...collectStacks(node.second)];
}

export type DockPathSegment = "first" | "second";

export function replaceNodeAtPath(
  root: DockNode | null,
  path: readonly DockPathSegment[],
  replacement: DockNode,
): DockNode | null {
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

function collectNodeIds(node: DockNode): Set<string> {
  if (node.kind === "stack") {
    return new Set([node.id]);
  }

  return new Set([node.id, ...collectNodeIds(node.first), ...collectNodeIds(node.second)]);
}
