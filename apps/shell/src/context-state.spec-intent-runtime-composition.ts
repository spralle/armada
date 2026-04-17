import type { SpecHarness } from "./context-state.spec-harness.js";
import { registerIntentRuntimeResolutionSpecs } from "./context-state.spec-intent-runtime-resolution.js";
import { registerIntentRuntimeTraceOperatorsSpecs } from "./context-state.spec-intent-runtime-trace-operators.js";
import { registerIntentRuntimeAdapterDemoSpecs } from "./context-state.spec-intent-runtime-adapter-demo.js";
import { registerIntentRuntimePluginCompositionSpecs } from "./context-state.spec-intent-runtime-plugin-composition.js";
import { registerIntentRuntimeIntegrationSpecs } from "./context-state.spec-intent-runtime-integration.js";
import { registerDomainIntentResolutionSpecs } from "./context-state.spec-domain-intent-resolution.js";
import { registerIntentChooserE2ESpecs } from "./context-state.spec-intent-chooser-e2e.js";
import { registerIntentErrorHandlingSpecs } from "./context-state.spec-intent-error-handling.js";
import { registerIntentConcurrencySpecs } from "./context-state.spec-intent-concurrency.js";

export function registerIntentRuntimeCompositionSpecs(harness: SpecHarness): void {
  registerIntentRuntimeResolutionSpecs(harness);
  registerIntentRuntimeTraceOperatorsSpecs(harness);
  registerIntentRuntimeAdapterDemoSpecs(harness);
  registerIntentRuntimePluginCompositionSpecs(harness);
  registerIntentRuntimeIntegrationSpecs(harness);
  registerDomainIntentResolutionSpecs(harness);
  registerIntentChooserE2ESpecs(harness);
  registerIntentErrorHandlingSpecs(harness);
  registerIntentConcurrencySpecs(harness);
}
