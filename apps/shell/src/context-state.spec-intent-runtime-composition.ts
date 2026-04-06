import type { SpecHarness } from "./context-state.spec-harness.js";
import { registerIntentRuntimeResolutionSpecs } from "./context-state.spec-intent-runtime-resolution.js";
import { registerIntentRuntimeTraceOperatorsSpecs } from "./context-state.spec-intent-runtime-trace-operators.js";
import { registerIntentRuntimeAdapterDemoSpecs } from "./context-state.spec-intent-runtime-adapter-demo.js";
import { registerIntentRuntimePluginCompositionSpecs } from "./context-state.spec-intent-runtime-plugin-composition.js";

export function registerIntentRuntimeCompositionSpecs(harness: SpecHarness): void {
  registerIntentRuntimeResolutionSpecs(harness);
  registerIntentRuntimeTraceOperatorsSpecs(harness);
  registerIntentRuntimeAdapterDemoSpecs(harness);
  registerIntentRuntimePluginCompositionSpecs(harness);
}
