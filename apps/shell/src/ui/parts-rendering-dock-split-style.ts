import type { DockNode } from "../context-state.js";
import { readDockSplitRatio } from "../context-state.js";

export function renderDockSplitTrackStyle(node: Extract<DockNode, { kind: "split" }>): string {
  const ratio = readDockSplitRatio(node);
  const splitTrackValue = renderDockSplitTrackValue(ratio);

  if (node.orientation === "horizontal") {
    return ` style="grid-template-columns: ${splitTrackValue};"`;
  }

  return ` style="grid-template-rows: ${splitTrackValue};"`;
}

export function renderDockSplitTrackValue(ratio: number): string {
  const firstRatio = formatDockSplitRatio(ratio);
  const secondRatio = formatDockSplitRatio(1 - ratio);

  return `minmax(0, ${firstRatio}fr) var(--dock-splitter-size, 8px) minmax(0, ${secondRatio}fr)`;
}

export function formatDockSplitRatio(value: number): string {
  return Number(value.toFixed(4)).toString();
}
