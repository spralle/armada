import type { DockNode, DockOrientation, DockSplitNode, DockStackNode } from "./dock-tree-types.js";

export interface StackRef {
  stack: DockStackNode;
  path: ReadonlyArray<"first" | "second">;
}

export function collectStacks(node: DockNode, path: ReadonlyArray<"first" | "second"> = []): StackRef[] {
  if (node.kind === "stack") {
    return [{ stack: node, path }];
  }

  return [
    ...collectStacks(node.first, [...path, "first"]),
    ...collectStacks(node.second, [...path, "second"]),
  ];
}

export function findStackByTabId(root: DockNode | null, tabId: string): StackRef | null {
  if (!root) {
    return null;
  }

  return collectStacks(root).find((entry) => entry.stack.tabIds.includes(tabId)) ?? null;
}

export function findStackById(root: DockNode, stackId: string): StackRef | null {
  return collectStacks(root).find((entry) => entry.stack.id === stackId) ?? null;
}

export function directionalDistance(
  fromPath: ReadonlyArray<"first" | "second">,
  toPath: ReadonlyArray<"first" | "second">,
  sourceSplitPath: readonly DockSplitNode[],
  direction: "left" | "right" | "up" | "down",
): number | null {
  const length = Math.min(fromPath.length, toPath.length);
  let divergence = -1;
  for (let index = 0; index < length; index += 1) {
    if (fromPath[index] !== toPath[index]) {
      divergence = index;
      break;
    }
  }

  if (divergence < 0) {
    return null;
  }

  const fromBranch = fromPath[divergence];
  const toBranch = toPath[divergence];
  const split = sourceSplitPath[divergence];
  if (!split) {
    return null;
  }

  const expectedOrientation: DockOrientation = direction === "left" || direction === "right"
    ? "horizontal"
    : "vertical";
  if (split.orientation !== expectedOrientation) {
    return null;
  }

  if (
    (direction === "left" || direction === "up") && fromBranch === "second" && toBranch === "first"
    || (direction === "right" || direction === "down") && fromBranch === "first" && toBranch === "second"
  ) {
    return fromPath.length - divergence;
  }

  return null;
}

export function collectSplitPath(root: DockNode, path: ReadonlyArray<"first" | "second">): DockSplitNode[] {
  const splits: DockSplitNode[] = [];
  let cursor: DockNode = root;
  for (const branch of path) {
    if (cursor.kind !== "split") {
      break;
    }

    splits.push(cursor);
    cursor = branch === "first" ? cursor.first : cursor.second;
  }

  return splits;
}

export function findNearestSplitForDirection(
  root: DockNode | null,
  path: ReadonlyArray<"first" | "second">,
  direction: "left" | "right" | "up" | "down",
): { node: DockSplitNode; branch: "first" | "second"; orientation: DockOrientation } | null {
  if (!root) {
    return null;
  }

  const splitPath: DockSplitNode[] = [];
  let cursor: DockNode = root;
  for (const branch of path) {
    if (cursor.kind !== "split") {
      break;
    }

    splitPath.push(cursor);
    cursor = branch === "first" ? cursor.first : cursor.second;
  }

  const expectedOrientation: DockOrientation = direction === "left" || direction === "right"
    ? "horizontal"
    : "vertical";

  for (let index = splitPath.length - 1; index >= 0; index -= 1) {
    const split = splitPath[index];
    const branch = path[index] ?? "first";
    if (split.orientation !== expectedOrientation) {
      continue;
    }

    if ((direction === "left" || direction === "up") && branch !== "second") {
      continue;
    }
    if ((direction === "right" || direction === "down") && branch !== "first") {
      continue;
    }

    return {
      node: split,
      branch,
      orientation: expectedOrientation,
    };
  }

  return null;
}

export function computeSplitDelta(
  orientation: DockOrientation,
  branch: "first" | "second",
  direction: "left" | "right" | "up" | "down",
  resizeStep: number,
): number {
  if (orientation === "horizontal") {
    if (direction === "left" && branch === "second") {
      return resizeStep;
    }
    if (direction === "right" && branch === "first") {
      return -resizeStep;
    }
    return 0;
  }

  if (direction === "up" && branch === "second") {
    return resizeStep;
  }
  if (direction === "down" && branch === "first") {
    return -resizeStep;
  }

  return 0;
}
