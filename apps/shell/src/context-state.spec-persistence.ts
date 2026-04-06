import type { SpecHarness } from "./context-state.spec-harness.js";
import { registerContextPersistenceContextSpecs } from "./context-state.spec-persistence-context.js";
import { registerContextPersistenceUnifiedSpecs } from "./context-state.spec-persistence-unified.js";

export function registerContextStatePersistenceSpecs(harness: SpecHarness): void {
  registerContextPersistenceContextSpecs(harness);
  registerContextPersistenceUnifiedSpecs(harness);
}
