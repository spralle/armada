import { applySelectionUpdate, createInitialShellContextState, readEntityTypeSelection } from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

export function registerContextStateCoreDerivedLanesSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("derived lanes are revision-linked and typed to selection write", () => {
    const initial = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    const revision = { timestamp: 200, writer: "writer-b" };
    const result = applySelectionUpdate(
      initial,
      {
        entityType: "vessel",
        selectedIds: ["v-9", "v-4"],
        priorityId: "v-9",
        revision,
      },
      {
        derivedGroupId: "group-main",
        derivedLanes: [
          {
            key: "selection.derived.secondary.priority",
            valueType: "entity-id",
            sourceEntityType: "vessel",
            scope: "group",
            derive: ({ sourceSelection }) => sourceSelection.priorityId ?? "none",
          },
        ],
      },
    );

    const lane = result.state.groupLanes["group-main"]["selection.derived.secondary.priority"];
    assertEqual(lane?.value, "v-9", "derived group lane value mismatch");
    assertEqual(lane?.valueType, "entity-id", "derived lane value type metadata mismatch");
    assertEqual(lane?.sourceSelection?.entityType, "vessel", "derived lane source entity metadata mismatch");
    assertEqual(
      lane?.sourceSelection?.revision.timestamp,
      revision.timestamp,
      "derived lane source revision timestamp mismatch",
    );
    assertEqual(
      lane?.sourceSelection?.revision.writer,
      revision.writer,
      "derived lane source revision writer mismatch",
    );
  });

  test("derived lane failures are isolated from context core updates", () => {
    const initial = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    const result = applySelectionUpdate(
      initial,
      {
        entityType: "order",
        selectedIds: ["o-1"],
        priorityId: "o-1",
        revision: { timestamp: 300, writer: "writer-c" },
      },
      {
        derivedGroupId: "group-main",
        derivedLanes: [
          {
            key: "selection.derived.fail",
            valueType: "entity-id",
            sourceEntityType: "order",
            scope: "group",
            derive: () => {
              throw new Error("boom");
            },
          },
        ],
      },
    );

    assertEqual(
      readEntityTypeSelection(result.state, "order").priorityId,
      "o-1",
      "selection write should succeed despite derived lane failure",
    );
    assertEqual(
      result.derivedLaneFailures.join(","),
      "selection.derived.fail",
      "failed derived lane should be reported",
    );
  });
}
