import type { SpecHarness } from "./context-state.spec-harness.js";
import { registerContextPersistenceContextSpecs } from "./context-state.spec-persistence-context.js";
import { registerContextPersistenceDockSpecs } from "./context-state.spec-persistence-dock.js";
import { registerContextPersistenceUtilityTabSpecs } from "./context-state.spec-persistence-utility-tabs.js";
import { registerContextPersistenceUnifiedSpecs } from "./context-state.spec-persistence-unified.js";

export function registerContextStatePersistenceSpecs(harness: SpecHarness): void {
  registerContextPersistenceContextSpecs(harness);
  registerContextPersistenceUtilityTabSpecs(harness);
  registerContextPersistenceDockSpecs(harness);
  registerContextPersistenceUnifiedSpecs(harness);
}
