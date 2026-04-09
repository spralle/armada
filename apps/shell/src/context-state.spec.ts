import { createSpecHarness } from "./context-state.spec-harness.js";
import { registerContextStateCoreSelectionLanesSpecs } from "./context-state.spec-core-selection-lanes.js";
import { registerIntentRuntimeCompositionSpecs } from "./context-state.spec-intent-runtime-composition.js";
import { registerContextStatePersistenceSpecs } from "./context-state.spec-persistence.js";
import { registerKeyboardA11ySpecs } from "./context-state.spec-keyboard-a11y.js";
import { registerSyncPopoutDegradedSpecs } from "./context-state.spec-sync-popout-degraded.js";
import { registerTabDragDropSpecs } from "./context-state.spec-tab-drag-drop.js";
import { registerDockTabDragDropSpecs } from "./context-state.spec-dock-tab-drag-drop.js";
import { registerRuntimeEventHandlersSpecs } from "./shell-runtime/runtime-event-handlers.spec.js";
import { registerActionContextSpecs } from "./context-state.spec-action-context.js";
import { registerCompositionParitySpecs } from "./context-state.spec-composition-parity.js";
import { registerBridgeUnavailableSpecs } from "./context-state.spec-bridge-unavailable.js";

const { harness, runAll } = createSpecHarness();

registerContextStateCoreSelectionLanesSpecs(harness);
registerIntentRuntimeCompositionSpecs(harness);
registerContextStatePersistenceSpecs(harness);
registerKeyboardA11ySpecs(harness);
registerSyncPopoutDegradedSpecs(harness);
registerTabDragDropSpecs(harness);
registerDockTabDragDropSpecs(harness);
registerRuntimeEventHandlersSpecs(harness);
registerActionContextSpecs(harness);
registerCompositionParitySpecs(harness);
registerBridgeUnavailableSpecs(harness);

const { passed, total } = runAll();

console.log(`context-state specs passed (${passed}/${total})`);
