import { createInitialShellContextState, setEntityTypeSelection } from "../context-state.js";
import { buildSelectionByEntityType, buildSelectionEnvelope } from "./parts-controller-selection-transition.js";

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`);
  }
}

test("buildSelectionByEntityType returns deterministic mapped selections", () => {
  let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
  state = setEntityTypeSelection(state, {
    entityType: "order",
    selectedIds: ["o-1", "o-2"],
    priorityId: "o-2",
  });

  const mapped = buildSelectionByEntityType(state);
  assertEqual(mapped.order?.priorityId, "o-2", "mapped selection should preserve entity priority id");
  assertEqual(mapped.order?.selectedIds.join(","), "o-1,o-2", "mapped selection should preserve entity ids");
});

test("buildSelectionEnvelope normalizes ids and includes revision", () => {
  const state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
  const envelope = buildSelectionEnvelope(state, {
    selectedPartId: "tab-a",
    selectedPartTitle: "Orders",
    sourceWindowId: "window-a",
    revision: { timestamp: 10, writer: "window-a" },
    selectedPartDefinitionId: "domain.orders",
  });

  assertEqual(envelope.type, "selection", "selection envelope should set event type");
  assertEqual(envelope.selectedPartInstanceId, "tab-a", "instance id should normalize from selected part id");
  assertEqual(envelope.selectedPartDefinitionId, "domain.orders", "definition id should preserve explicit value");
  assertEqual(envelope.revision?.writer, "window-a", "selection envelope should carry explicit revision");
});

let passed = 0;
for (const caseItem of tests) {
  try {
    caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`parts-controller-selection-transition spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`parts-controller-selection-transition specs passed (${passed}/${tests.length})`);
