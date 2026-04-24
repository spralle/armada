import {
  applySelectionUpdate,
  createInitialShellContextState,
  readEntityTypeSelection,
} from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

export function registerContextStateCorePropagationSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("selection propagation updates dependent entity type deterministically", () => {
    const initial = createInitialShellContextState({ initialTabId: "tab-a" });
    const result = applySelectionUpdate(
      initial,
      {
        entityType: "order",
        selectedIds: ["o-2"],
        priorityId: "o-2",
        revision: { timestamp: 100, writer: "writer-a" },
      },
      {
        propagationRules: [
          {
            id: "rule.order->vessel",
            sourceEntityType: "order",
            propagate: ({ sourceSelection }) => ({
              entityType: "vessel",
              selectedIds: sourceSelection.priorityId ? [`v-for-${sourceSelection.priorityId}`] : [],
              priorityId: sourceSelection.priorityId ? `v-for-${sourceSelection.priorityId}` : null,
            }),
          },
        ],
      },
    );

    assertEqual(
      readEntityTypeSelection(result.state, "vessel").priorityId,
      "v-for-o-2",
      "dependent vessel selection should follow primary order selection",
    );
    assertEqual(
      result.changedEntityTypes.join(","),
      "order,vessel",
      "propagation stage should process source then dependent deterministically",
    );
  });

  test("selection propagation supports generic receiver interests across multiple entity targets", () => {
    const initial = createInitialShellContextState({ initialTabId: "tab-a" });
    const result = applySelectionUpdate(
      initial,
      {
        entityType: "order",
        selectedIds: ["o-2"],
        priorityId: "o-2",
        revision: { timestamp: 110, writer: "writer-a" },
      },
      {
        propagationRules: [
          {
            id: "rule.order->vessel",
            sourceEntityType: "order",
            propagate: ({ sourceSelection }) => ({
              entityType: "vessel",
              selectedIds: sourceSelection.priorityId ? [`v-for-${sourceSelection.priorityId}`] : [],
              priorityId: sourceSelection.priorityId ? `v-for-${sourceSelection.priorityId}` : null,
            }),
          },
          {
            id: "rule.order->terminal",
            sourceEntityType: "order",
            propagate: ({ sourceSelection }) => ({
              entityType: "terminal",
              selectedIds: sourceSelection.priorityId ? [`t-for-${sourceSelection.priorityId}`] : [],
              priorityId: sourceSelection.priorityId ? `t-for-${sourceSelection.priorityId}` : null,
            }),
          },
        ],
      },
    );

    assertEqual(
      readEntityTypeSelection(result.state, "vessel").priorityId,
      "v-for-o-2",
      "receiver vessel should be derived from order interest",
    );
    assertEqual(
      readEntityTypeSelection(result.state, "terminal").priorityId,
      "t-for-o-2",
      "receiver terminal should be derived from order interest",
    );
    assertEqual(
      result.changedEntityTypes.join(","),
      "order,terminal,vessel",
      "receiver processing should be deterministic across multiple interests",
    );
  });
}
