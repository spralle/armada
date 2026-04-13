import type { SpecHarness } from "./context-state.spec-harness.js";
import { registerSyncPopoutDegradedModeSpecs } from "./context-state.spec-sync-popout-degraded-mode.js";
import { registerSyncPopoutFlowSpecs } from "./context-state.spec-sync-popout-flow.js";
import { registerSyncPopoutRestoreSpecs } from "./context-state.spec-sync-popout-restore.js";

export function registerSyncPopoutDegradedSpecs(harness: SpecHarness): void {
  registerSyncPopoutDegradedModeSpecs(harness);
  registerSyncPopoutRestoreSpecs(harness);
  registerSyncPopoutFlowSpecs(harness);
}
