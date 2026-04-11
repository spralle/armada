import type { SpecHarness } from "../../context-state.spec-harness.js";
import type { QuickPickItem } from "@ghost/plugin-contracts";
import {
  createInitialQuickPickState,
  reduceQuickPickState,
  getSelectedItem,
  scoreQuickPickItems,
  computeFuzzyScore,
} from "./quick-pick-state.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface TestItem extends QuickPickItem {
  id: string;
}

function makeItem(
  overrides: Partial<TestItem> & { id: string; label: string },
): TestItem {
  return {
    enabled: true,
    ...overrides,
  };
}

function sampleItems(): readonly TestItem[] {
  return [
    makeItem({ id: "shell.focus.left", label: "Focus Left Panel" }),
    makeItem({ id: "shell.focus.right", label: "Focus Right Panel" }),
    makeItem({
      id: "shell.toggle.sidebar",
      label: "Toggle Sidebar",
      description: "command",
    }),
    makeItem({
      id: "plugin.run.test",
      label: "Run Tests",
      description: "plugin.testing",
    }),
    makeItem({
      id: "plugin.disabled.action",
      label: "Disabled Action",
      enabled: false,
      detail: "Requires admin role",
    }),
  ];
}

// ---------------------------------------------------------------------------
// Spec registration
// ---------------------------------------------------------------------------

export function registerQuickPickStateSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  // 1. createInitialQuickPickState returns closed state
  test("createInitialQuickPickState returns closed state", () => {
    const state = createInitialQuickPickState<TestItem>();
    assertEqual(state.phase, "closed", "phase should be closed");
    assertEqual(state.filter, "", "filter should be empty");
    assertEqual(state.selectedIndex, 0, "selectedIndex should be 0");
    assertEqual(state.items.length, 0, "items should be empty");
    assertEqual(state.filteredItems.length, 0, "filteredItems should be empty");
  });

  // 2. open transitions to open phase with items and filtered list
  test("open transitions to open phase with items", () => {
    const items = sampleItems();
    const state = reduceQuickPickState(
      createInitialQuickPickState<TestItem>(),
      { type: "open", items },
    );

    assertEqual(state.phase, "open", "phase should be open");
    assertEqual(state.filter, "", "filter should be empty on open");
    assertEqual(state.selectedIndex, 0, "selectedIndex should be 0 on open");
    assertEqual(state.items.length, items.length, "items should be populated");
    assertEqual(
      state.filteredItems.length,
      items.length,
      "all items should appear in filteredItems",
    );
  });

  // 3. close returns to initial state
  test("close returns to initial state", () => {
    const items = sampleItems();
    const openState = reduceQuickPickState(
      createInitialQuickPickState<TestItem>(),
      { type: "open", items },
    );
    const closedState = reduceQuickPickState(openState, { type: "close" });

    assertEqual(closedState.phase, "closed", "phase should be closed");
    assertEqual(closedState.filter, "", "filter should be empty");
    assertEqual(closedState.items.length, 0, "items should be empty");
    assertEqual(closedState.filteredItems.length, 0, "filteredItems should be empty");
  });

  // 4. updateFilter filters items and resets selectedIndex
  test("updateFilter filters items and resets selectedIndex", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(
      createInitialQuickPickState<TestItem>(),
      { type: "open", items },
    );
    state = reduceQuickPickState(state, { type: "selectNext" });
    assertEqual(state.selectedIndex, 1, "selectedIndex should be 1");

    state = reduceQuickPickState(state, {
      type: "updateFilter",
      filter: "Focus",
    });
    assertEqual(state.selectedIndex, 0, "selectedIndex should reset to 0");
    assertEqual(state.filter, "Focus", "filter should be updated");
    assertEqual(state.filteredItems.length, 2, "filter should narrow results");
  });

  // 5. updateFilter with empty string shows all items
  test("updateFilter with empty string shows all items", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(
      createInitialQuickPickState<TestItem>(),
      { type: "open", items },
    );
    state = reduceQuickPickState(state, {
      type: "updateFilter",
      filter: "Focus",
    });
    assertEqual(state.filteredItems.length, 2, "filtered should be narrowed");

    state = reduceQuickPickState(state, {
      type: "updateFilter",
      filter: "",
    });
    assertEqual(
      state.filteredItems.length,
      items.length,
      "empty filter should show all items",
    );
  });

  // 6. selectNext wraps around at end
  test("selectNext wraps around at end", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(
      createInitialQuickPickState<TestItem>(),
      { type: "open", items },
    );

    for (let i = 0; i < items.length - 1; i++) {
      state = reduceQuickPickState(state, { type: "selectNext" });
    }
    assertEqual(state.selectedIndex, items.length - 1, "should be at last");

    state = reduceQuickPickState(state, { type: "selectNext" });
    assertEqual(state.selectedIndex, 0, "selectNext should wrap to 0");
  });

  // 7. selectPrevious wraps around at start
  test("selectPrevious wraps around at start", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(
      createInitialQuickPickState<TestItem>(),
      { type: "open", items },
    );
    assertEqual(state.selectedIndex, 0, "should start at 0");

    state = reduceQuickPickState(state, { type: "selectPrevious" });
    assertEqual(
      state.selectedIndex,
      state.filteredItems.length - 1,
      "selectPrevious should wrap to last",
    );
  });

  // 8. selectIndex clamps to valid range
  test("selectIndex clamps to valid range", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(
      createInitialQuickPickState<TestItem>(),
      { type: "open", items },
    );

    state = reduceQuickPickState(state, { type: "selectIndex", index: 999 });
    assertEqual(
      state.selectedIndex,
      state.filteredItems.length - 1,
      "should clamp to max",
    );

    state = reduceQuickPickState(state, { type: "selectIndex", index: -5 });
    assertEqual(state.selectedIndex, 0, "should clamp negative to 0");
  });

  // 9. getSelectedItem returns correct item
  test("getSelectedItem returns correct item", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(
      createInitialQuickPickState<TestItem>(),
      { type: "open", items },
    );

    const first = getSelectedItem(state);
    assertTruthy(first, "getSelectedItem should return an item");

    state = reduceQuickPickState(state, { type: "selectNext" });
    const second = getSelectedItem(state);
    assertTruthy(second, "should return an item after selectNext");
    assertTruthy(
      first!.id !== second!.id ||
        first!.label !== second!.label ||
        state.selectedIndex === 0,
      "selected item should change after selectNext",
    );
  });

  // 10. getSelectedItem returns null when no items
  test("getSelectedItem returns null when no items", () => {
    const state = createInitialQuickPickState<TestItem>();
    const item = getSelectedItem(state);
    assertEqual(item, null, "should return null when no items");
  });

  // 11. Fuzzy scoring: exact label match scores highest
  test("fuzzy scoring: exact label match scores highest", () => {
    const item = makeItem({ id: "a", label: "Focus Left Panel" });
    const score = computeFuzzyScore(item, "focus left panel");
    assertTruthy(score >= 90, "exact label contains should score >= 90");
  });

  // 12. Fuzzy scoring: prefix match ranks above substring match
  test("fuzzy scoring: prefix match ranks above substring", () => {
    const item = makeItem({ id: "a", label: "Focus Left Panel" });
    const prefixScore = computeFuzzyScore(item, "focus");
    const substringScore = computeFuzzyScore(item, "left");
    assertTruthy(
      prefixScore > substringScore,
      `prefix (${prefixScore}) > substring (${substringScore})`,
    );
  });

  // 13. Fuzzy scoring: subsequence match works
  test("fuzzy scoring: subsequence match works", () => {
    const item = makeItem({ id: "a", label: "Focus Left Panel" });
    const score = computeFuzzyScore(item, "flp");
    assertTruthy(score > 0, "subsequence 'flp' should match");
    assertTruthy(score >= 50, "label subsequence should score >= 50");
  });

  // 14. Fuzzy scoring: no-match items are excluded
  test("fuzzy scoring: no-match items are excluded", () => {
    const item = makeItem({ id: "a", label: "Focus Left Panel" });
    const score = computeFuzzyScore(item, "zzz");
    assertEqual(score, 0, "non-matching needle should score 0");
  });

  // 15. Enabled items sort before disabled when scores are equal
  test("enabled items sort before disabled when scores equal", () => {
    const items: readonly TestItem[] = [
      makeItem({ id: "b", label: "Beta Action", enabled: false }),
      makeItem({ id: "a", label: "Alpha Action", enabled: true }),
    ];
    const scored = scoreQuickPickItems(items, "");
    assertEqual(scored[0]?.item.id, "a", "enabled item should sort first");
    assertEqual(scored[1]?.item.id, "b", "disabled item should sort second");
  });

  // 16. Empty filter returns all items sorted enabled-first then alphabetical
  test("empty filter returns all items sorted enabled-first alphabetical", () => {
    const items: readonly TestItem[] = [
      makeItem({ id: "z", label: "Zebra Command", enabled: true }),
      makeItem({ id: "a", label: "Alpha Command", enabled: false }),
      makeItem({ id: "m", label: "Middle Command", enabled: true }),
    ];
    const scored = scoreQuickPickItems(items, "");
    assertEqual(scored.length, 3, "all items should be returned");
    assertEqual(scored[0]?.item.id, "m", "first enabled alphabetical");
    assertEqual(scored[1]?.item.id, "z", "second enabled alphabetical");
    assertEqual(scored[2]?.item.id, "a", "disabled item last");
  });

  // 17. matchOnDescription enables description matching
  test("matchOnDescription enables description matching", () => {
    const item = makeItem({
      id: "a",
      label: "Some Action",
      description: "useful utility",
    });
    const withoutOpt = computeFuzzyScore(item, "useful");
    const withOpt = computeFuzzyScore(item, "useful", {
      matchOnDescription: true,
    });
    assertEqual(withoutOpt, 0, "should not match without option");
    assertEqual(withOpt, 70, "should match description with option");
  });

  // 18. matchOnDetail enables detail matching
  test("matchOnDetail enables detail matching", () => {
    const item = makeItem({
      id: "a",
      label: "Some Action",
      detail: "detailed info here",
    });
    const withoutOpt = computeFuzzyScore(item, "detailed");
    const withOpt = computeFuzzyScore(item, "detailed", {
      matchOnDetail: true,
    });
    assertEqual(withoutOpt, 0, "should not match without option");
    assertEqual(withOpt, 60, "should match detail with option");
  });

  // 19. setItems action updates items and re-scores
  test("setItems updates items and re-scores", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(
      createInitialQuickPickState<TestItem>(),
      { type: "open", items },
    );
    assertEqual(state.items.length, 5, "should have 5 items initially");

    const newItems = [makeItem({ id: "new.1", label: "New Item" })];
    state = reduceQuickPickState(state, { type: "setItems", items: newItems });
    assertEqual(state.items.length, 1, "should have 1 item after setItems");
    assertEqual(state.filteredItems.length, 1, "filtered should update");
    assertEqual(state.selectedIndex, 0, "selectedIndex should reset to 0");
  });
}
