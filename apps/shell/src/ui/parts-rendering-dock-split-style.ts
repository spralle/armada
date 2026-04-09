import type { DockNode } from "../context-state.js";
import { readDockSplitRatio } from "../context-state.js";

export function renderDockSplitTrackStyle(node: Extract<DockNode, { kind: "split" }>): string {
  const ratio = readDockSplitRatio(node);
  const firstRatio = formatDockSplitRatio(ratio);
  const secondRatio = formatDockSplitRatio(1 - ratio);

  if (node.orientation === "horizontal") {
    return ` style="grid-template-columns: minmax(0, ${firstRatio}fr) var(--dock-splitter-size, 8px) minmax(0, ${secondRatio}fr);"`;
  }

  return ` style="grid-template-rows: minmax(0, ${firstRatio}fr) var(--dock-splitter-size, 8px) minmax(0, ${secondRatio}fr);"`;
}

function formatDockSplitRatio(value: number): string {
  return Number(value.toFixed(4)).toString();
}
