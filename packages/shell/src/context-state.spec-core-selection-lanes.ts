import type { SpecHarness } from "./context-state.spec-harness.js";
import { registerContextStateCoreGroupTabLanesSpecs } from "./context-state.spec-core-group-tab-lanes.js";
import { registerContextStateCoreSelectionGraphSpecs } from "./context-state.spec-core-selection-graph.js";
import { registerContextStateCorePropagationSpecs } from "./context-state.spec-core-propagation.js";
import { registerContextStateCoreDerivedLanesSpecs } from "./context-state.spec-core-derived-lanes.js";
import { registerDockTreeStateSpecs } from "./context-state.spec-dock-tree.js";
import { registerDockTreeCommandSpecs } from "./context-state.spec-dock-tree-operations.js";
import { registerContextStateInstanceWindowIndependenceSpecs } from "./context-state.spec-instance-window-independence.js";

export function registerContextStateCoreSelectionLanesSpecs(harness: SpecHarness): void {
  registerContextStateCoreGroupTabLanesSpecs(harness);
  registerContextStateCoreSelectionGraphSpecs(harness);
  registerContextStateCorePropagationSpecs(harness);
  registerContextStateCoreDerivedLanesSpecs(harness);
  registerDockTreeStateSpecs(harness);
  registerDockTreeCommandSpecs(harness);
  registerContextStateInstanceWindowIndependenceSpecs(harness);
}
