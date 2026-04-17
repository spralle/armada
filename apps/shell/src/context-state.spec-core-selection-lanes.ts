import type { SpecHarness } from "./context-state.spec-harness.js";
import { registerContextStateCoreGroupTabLanesSpecs } from "./context-state.spec-core-group-tab-lanes.js";
import { registerContextStateCoreSelectionGraphSpecs } from "./context-state.spec-core-selection-graph.js";
import { registerDockTreeStateSpecs } from "./context-state.spec-dock-tree.js";
import { registerDockTreeCommandSpecs } from "./context-state.spec-dock-tree-commands.js";
import { registerContextStateInstanceWindowIndependenceSpecs } from "./context-state.spec-instance-window-independence.js";

export function registerContextStateCoreSelectionLanesSpecs(harness: SpecHarness): void {
  registerContextStateCoreGroupTabLanesSpecs(harness);
  registerContextStateCoreSelectionGraphSpecs(harness);
  registerDockTreeStateSpecs(harness);
  registerDockTreeCommandSpecs(harness);
  registerContextStateInstanceWindowIndependenceSpecs(harness);
}
