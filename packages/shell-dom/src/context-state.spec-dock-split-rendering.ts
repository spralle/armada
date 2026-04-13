import type { DockNode } from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { renderDockSplitTrackStyle } from "./ui/parts-rendering-dock-split-style.js";

function createSplitNode(input: {
  id: string;
  orientation: "horizontal" | "vertical";
  ratio?: number;
}): Extract<DockNode, { kind: "split" }> {
  const first: Extract<DockNode, { kind: "stack" }> = {
    kind: "stack",
    id: "stack-first",
    tabIds: ["tab-a"],
    activeTabId: "tab-a",
  };

  const second: Extract<DockNode, { kind: "stack" }> = {
    kind: "stack",
    id: "stack-second",
    tabIds: ["tab-b"],
    activeTabId: "tab-b",
  };

  return {
    kind: "split",
    id: input.id,
    orientation: input.orientation,
    ratio: input.ratio,
    first,
    second,
  };
}

export function registerDockSplitRenderingSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("dock split rendering uses ratio-based horizontal columns", () => {
    const style = renderDockSplitTrackStyle(createSplitNode({
      id: "split-horizontal",
      orientation: "horizontal",
      ratio: 0.3,
    }));

    assertEqual(
      style,
      " style=\"grid-template-columns: minmax(0, 0.3fr) var(--dock-splitter-size, 8px) minmax(0, 0.7fr);\"",
      "horizontal split should emit ratio columns",
    );
  });

  test("dock split rendering uses ratio-based vertical rows", () => {
    const style = renderDockSplitTrackStyle(createSplitNode({
      id: "split-vertical",
      orientation: "vertical",
      ratio: 0.65,
    }));

    assertEqual(
      style,
      " style=\"grid-template-rows: minmax(0, 0.65fr) var(--dock-splitter-size, 8px) minmax(0, 0.35fr);\"",
      "vertical split should emit ratio rows",
    );
  });

  test("dock split rendering defaults to 50/50 when ratio missing", () => {
    const style = renderDockSplitTrackStyle(createSplitNode({
      id: "split-default-ratio",
      orientation: "horizontal",
    }));

    assertEqual(
      style,
      " style=\"grid-template-columns: minmax(0, 0.5fr) var(--dock-splitter-size, 8px) minmax(0, 0.5fr);\"",
      "missing ratio should fall back to equal columns",
    );
  });
}
