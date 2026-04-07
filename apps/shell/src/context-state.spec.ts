import { createSpecHarness } from "./context-state.spec-harness.js";
import { registerContextStateCoreSelectionLanesSpecs } from "./context-state.spec-core-selection-lanes.js";
import { registerIntentRuntimeCompositionSpecs } from "./context-state.spec-intent-runtime-composition.js";
import { registerContextStatePersistenceSpecs } from "./context-state.spec-persistence.js";
import { registerKeyboardA11ySpecs } from "./context-state.spec-keyboard-a11y.js";
import { registerSyncPopoutDegradedSpecs } from "./context-state.spec-sync-popout-degraded.js";
import { registerTabDragDropSpecs } from "./context-state.spec-tab-drag-drop.js";

const { harness, runAll } = createSpecHarness();

registerContextStateCoreSelectionLanesSpecs(harness);
registerIntentRuntimeCompositionSpecs(harness);
registerContextStatePersistenceSpecs(harness);
registerKeyboardA11ySpecs(harness);
registerSyncPopoutDegradedSpecs(harness);
registerTabDragDropSpecs(harness);

const { passed, total } = runAll();

console.log(`context-state specs passed (${passed}/${total})`);
