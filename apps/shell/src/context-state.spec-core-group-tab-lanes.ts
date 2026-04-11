import type { SpecHarness } from "./context-state.spec-harness.js";
import { registerContextStateCoreLaneIsolationSpecs } from "./context-state.spec-core-lane-isolation.js";
import { registerContextStateCoreRuntimeTabContextSpecs } from "./context-state.spec-core-runtime-tab-context.js";
import { registerContextStateCoreTabLifecycleSpecs } from "./context-state.spec-core-tab-lifecycle.js";
import { registerContextStateCoreTabLifecycleReopenSpecs } from "./context-state.spec-core-tab-lifecycle-reopen.js";

export function registerContextStateCoreGroupTabLanesSpecs(harness: SpecHarness): void {
  registerContextStateCoreLaneIsolationSpecs(harness);
  registerContextStateCoreTabLifecycleSpecs(harness);
  registerContextStateCoreTabLifecycleReopenSpecs(harness);
  registerContextStateCoreRuntimeTabContextSpecs(harness);
}
