import {
  addEntityTypeSelectionId,
  createInitialShellContextState,
  moveEntityTypeSelectionId,
  readEntityTypeSelection,
  removeEntityTypeSelectionId,
  setEntityTypePriority,
  setEntityTypeSelection,
} from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

export function registerContextStateCoreSelectionGraphSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("selection graph stores ordered IDs per entity type concurrently", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a" });
    state = setEntityTypeSelection(state, {
      entityType: "order",
      selectedIds: ["o-3", "o-1", "o-2"],
      priorityId: "o-1",
    });
    state = setEntityTypeSelection(state, {
      entityType: "vessel",
      selectedIds: ["v-9", "v-2"],
      priorityId: "v-2",
    });

    const orderSelection = readEntityTypeSelection(state, "order");
    const vesselSelection = readEntityTypeSelection(state, "vessel");

    assertEqual(orderSelection.selectedIds.join(","), "o-3,o-1,o-2", "order selection order mismatch");
    assertEqual(orderSelection.priorityId, "o-1", "order priority mismatch");
    assertEqual(vesselSelection.selectedIds.join(","), "v-9,v-2", "vessel selection order mismatch");
    assertEqual(vesselSelection.priorityId, "v-2", "vessel priority mismatch");
  });

  test("selection graph keeps priority member of selected IDs", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a" });
    state = setEntityTypeSelection(state, {
      entityType: "order",
      selectedIds: ["o-1", "o-2"],
      priorityId: "o-99",
    });

    let selection = readEntityTypeSelection(state, "order");
    assertEqual(selection.priorityId, "o-1", "invalid priority should fall back to first selected id");

    state = removeEntityTypeSelectionId(state, {
      entityType: "order",
      id: "o-1",
    });
    selection = readEntityTypeSelection(state, "order");
    assertEqual(selection.priorityId, "o-2", "priority should shift when current priority is removed");

    state = setEntityTypePriority(state, {
      entityType: "order",
      priorityId: "o-404",
    });
    selection = readEntityTypeSelection(state, "order");
    assertEqual(selection.priorityId, "o-2", "priority setter should enforce membership");
  });

  test("selection graph supports ordered add and move operations", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a" });
    state = addEntityTypeSelectionId(state, {
      entityType: "order",
      id: "o-1",
    });
    state = addEntityTypeSelectionId(state, {
      entityType: "order",
      id: "o-2",
    });
    state = addEntityTypeSelectionId(state, {
      entityType: "order",
      id: "o-3",
      index: 1,
      prioritize: true,
    });

    state = moveEntityTypeSelectionId(state, {
      entityType: "order",
      id: "o-1",
      toIndex: 2,
    });

    const selection = readEntityTypeSelection(state, "order");
    assertEqual(selection.selectedIds.join(","), "o-3,o-2,o-1", "ordered operations should maintain deterministic order");
    assertEqual(selection.priorityId, "o-3", "priority should remain explicit unless invalidated");
  });

  test("selection graph deduplicates selected IDs and stores ID-only payload", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a" });
    state = setEntityTypeSelection(state, {
      entityType: "order",
      selectedIds: ["o-1", "o-1", "o-2", "", "o-2"],
      priorityId: "o-2",
    });

    const selection = readEntityTypeSelection(state, "order");
    assertEqual(selection.selectedIds.join(","), "o-1,o-2", "selection should be de-duplicated and keep order");
    assertEqual(typeof selection.selectedIds[0], "string", "selection should store string IDs only");
    assertEqual(selection.priorityId, "o-2", "priority should remain valid after de-duplication");
  });
}
