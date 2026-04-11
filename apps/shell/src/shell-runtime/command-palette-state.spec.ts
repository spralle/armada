import type { SpecHarness } from "../context-state.spec-harness.js";
import type { CommandPaletteEntry } from "./command-palette-state.js";
import {
  createInitialPaletteState,
  reducePaletteState,
  getSelectedEntry,
  scorePaletteEntries,
  computeFuzzyScore,
} from "./command-palette-state.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<CommandPaletteEntry> & { id: string; title: string }): CommandPaletteEntry {
  return {
    category: "action",
    keybindingHint: null,
    enabled: true,
    disabledReason: null,
    pluginId: "test.plugin",
    ...overrides,
  };
}

function sampleEntries(): readonly CommandPaletteEntry[] {
  return [
    makeEntry({ id: "shell.focus.left", title: "Focus Left Panel" }),
    makeEntry({ id: "shell.focus.right", title: "Focus Right Panel" }),
    makeEntry({ id: "shell.toggle.sidebar", title: "Toggle Sidebar", category: "command" }),
    makeEntry({ id: "plugin.run.test", title: "Run Tests", pluginId: "plugin.testing" }),
    makeEntry({
      id: "plugin.disabled.action",
      title: "Disabled Action",
      enabled: false,
      disabledReason: "Requires admin role",
    }),
  ];
}

// ---------------------------------------------------------------------------
// Spec registration
// ---------------------------------------------------------------------------

export function registerCommandPaletteStateSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  // 1. createInitialPaletteState returns closed state
  test("createInitialPaletteState returns closed state", () => {
    const state = createInitialPaletteState();
    assertEqual(state.phase, "closed", "phase should be closed");
    assertEqual(state.filter, "", "filter should be empty");
    assertEqual(state.selectedIndex, 0, "selectedIndex should be 0");
    assertEqual(state.entries.length, 0, "entries should be empty");
    assertEqual(state.filteredEntries.length, 0, "filteredEntries should be empty");
  });

  // 2. open transitions to open phase with entries and filtered list
  test("open transitions to open phase with entries and filtered list", () => {
    const entries = sampleEntries();
    const state = reducePaletteState(createInitialPaletteState(), {
      type: "open",
      entries,
    });

    assertEqual(state.phase, "open", "phase should be open");
    assertEqual(state.filter, "", "filter should be empty on open");
    assertEqual(state.selectedIndex, 0, "selectedIndex should be 0 on open");
    assertEqual(state.entries.length, entries.length, "entries should be populated");
    assertEqual(state.filteredEntries.length, entries.length, "all entries should appear in filteredEntries");
  });

  // 3. close returns to initial state
  test("close returns to initial state", () => {
    const entries = sampleEntries();
    const openState = reducePaletteState(createInitialPaletteState(), {
      type: "open",
      entries,
    });
    const closedState = reducePaletteState(openState, { type: "close" });

    assertEqual(closedState.phase, "closed", "phase should be closed after close");
    assertEqual(closedState.filter, "", "filter should be empty after close");
    assertEqual(closedState.entries.length, 0, "entries should be empty after close");
    assertEqual(closedState.filteredEntries.length, 0, "filteredEntries should be empty after close");
  });

  // 4. updateFilter filters entries and resets selectedIndex
  test("updateFilter filters entries and resets selectedIndex", () => {
    const entries = sampleEntries();
    let state = reducePaletteState(createInitialPaletteState(), {
      type: "open",
      entries,
    });
    // Move selection forward first
    state = reducePaletteState(state, { type: "selectNext" });
    assertEqual(state.selectedIndex, 1, "selectedIndex should be 1 after selectNext");

    // Apply filter
    state = reducePaletteState(state, { type: "updateFilter", filter: "Focus" });
    assertEqual(state.selectedIndex, 0, "selectedIndex should reset to 0 on filter change");
    assertEqual(state.filter, "Focus", "filter should be updated");
    // Only "Focus Left Panel" and "Focus Right Panel" should match
    assertEqual(state.filteredEntries.length, 2, "filter should narrow results");
  });

  // 5. updateFilter with empty string shows all entries
  test("updateFilter with empty string shows all entries", () => {
    const entries = sampleEntries();
    let state = reducePaletteState(createInitialPaletteState(), {
      type: "open",
      entries,
    });
    state = reducePaletteState(state, { type: "updateFilter", filter: "Focus" });
    assertEqual(state.filteredEntries.length, 2, "filtered results should be narrowed");

    state = reducePaletteState(state, { type: "updateFilter", filter: "" });
    assertEqual(state.filteredEntries.length, entries.length, "empty filter should show all entries");
  });

  // 6. selectNext wraps around at end
  test("selectNext wraps around at end", () => {
    const entries = sampleEntries();
    let state = reducePaletteState(createInitialPaletteState(), {
      type: "open",
      entries,
    });

    // Move to last entry
    for (let i = 0; i < entries.length - 1; i++) {
      state = reducePaletteState(state, { type: "selectNext" });
    }
    assertEqual(state.selectedIndex, entries.length - 1, "selectedIndex should be at last entry");

    // One more should wrap to 0
    state = reducePaletteState(state, { type: "selectNext" });
    assertEqual(state.selectedIndex, 0, "selectNext should wrap to 0");
  });

  // 7. selectPrevious wraps around at start
  test("selectPrevious wraps around at start", () => {
    const entries = sampleEntries();
    let state = reducePaletteState(createInitialPaletteState(), {
      type: "open",
      entries,
    });
    assertEqual(state.selectedIndex, 0, "selectedIndex should start at 0");

    state = reducePaletteState(state, { type: "selectPrevious" });
    assertEqual(
      state.selectedIndex,
      state.filteredEntries.length - 1,
      "selectPrevious should wrap to last entry",
    );
  });

  // 8. selectIndex clamps to valid range
  test("selectIndex clamps to valid range", () => {
    const entries = sampleEntries();
    let state = reducePaletteState(createInitialPaletteState(), {
      type: "open",
      entries,
    });

    state = reducePaletteState(state, { type: "selectIndex", index: 999 });
    assertEqual(
      state.selectedIndex,
      state.filteredEntries.length - 1,
      "selectIndex should clamp to max valid index",
    );

    state = reducePaletteState(state, { type: "selectIndex", index: -5 });
    assertEqual(state.selectedIndex, 0, "selectIndex should clamp negative to 0");
  });

  // 9. getSelectedEntry returns correct entry
  test("getSelectedEntry returns correct entry", () => {
    const entries = sampleEntries();
    let state = reducePaletteState(createInitialPaletteState(), {
      type: "open",
      entries,
    });

    const first = getSelectedEntry(state);
    assertTruthy(first, "getSelectedEntry should return an entry");

    state = reducePaletteState(state, { type: "selectNext" });
    const second = getSelectedEntry(state);
    assertTruthy(second, "getSelectedEntry should return an entry after selectNext");
    assertTruthy(
      first!.id !== second!.id || first!.title !== second!.title || state.selectedIndex === 0,
      "selected entry should change after selectNext (or wrap if only one entry)",
    );
  });

  // 10. getSelectedEntry returns null when no entries
  test("getSelectedEntry returns null when no entries", () => {
    const state = createInitialPaletteState();
    const entry = getSelectedEntry(state);
    assertEqual(entry, null, "getSelectedEntry should return null when no entries");
  });

  // 11. Fuzzy scoring: exact title match scores highest
  test("fuzzy scoring: exact title match scores highest", () => {
    const entry = makeEntry({ id: "shell.focus.left", title: "Focus Left Panel" });
    const score = computeFuzzyScore(entry, "focus left panel");
    assertTruthy(score >= 90, "exact title contains should score >= 90");
  });

  // 12. Fuzzy scoring: prefix match ranks above substring match
  test("fuzzy scoring: prefix match ranks above substring match", () => {
    const entry = makeEntry({ id: "shell.focus.left", title: "Focus Left Panel" });
    const prefixScore = computeFuzzyScore(entry, "focus");
    const substringScore = computeFuzzyScore(entry, "left");
    assertTruthy(
      prefixScore > substringScore,
      `prefix score (${prefixScore}) should be higher than substring score (${substringScore})`,
    );
  });

  // 13. Fuzzy scoring: subsequence match works (e.g., "fle" matches "shell.focus.left")
  test("fuzzy scoring: subsequence match works", () => {
    const entry = makeEntry({ id: "shell.focus.left", title: "Focus Left Panel" });
    // "fle" is a subsequence of "focus left panel" (f...l...e... actually f->l->e doesn't work in title)
    // Use "flp" = F(ocus) L(eft) P(anel) — subsequence in title
    const score = computeFuzzyScore(entry, "flp");
    assertTruthy(score > 0, "subsequence 'flp' should match 'Focus Left Panel'");
    assertTruthy(score >= 50, "title subsequence score should be >= 50");
  });

  // 14. Fuzzy scoring: no-match entries are excluded
  test("fuzzy scoring: no-match entries are excluded", () => {
    const entry = makeEntry({ id: "shell.focus.left", title: "Focus Left Panel" });
    const score = computeFuzzyScore(entry, "zzz");
    assertEqual(score, 0, "non-matching needle should score 0");
  });

  // 15. Enabled entries sort before disabled when scores are equal
  test("enabled entries sort before disabled when scores are equal", () => {
    const entries: readonly CommandPaletteEntry[] = [
      makeEntry({ id: "b.action", title: "Beta Action", enabled: false, disabledReason: "nope" }),
      makeEntry({ id: "a.action", title: "Alpha Action", enabled: true }),
    ];
    const scored = scorePaletteEntries(entries, "");
    assertEqual(scored[0]?.entry.id, "a.action", "enabled entry should sort first");
    assertEqual(scored[1]?.entry.id, "b.action", "disabled entry should sort second");
  });

  // 16. Empty filter returns all entries sorted enabled-first then alphabetical
  test("empty filter returns all entries sorted enabled-first then alphabetical", () => {
    const entries: readonly CommandPaletteEntry[] = [
      makeEntry({ id: "z.cmd", title: "Zebra Command", enabled: true }),
      makeEntry({ id: "a.cmd", title: "Alpha Command", enabled: false, disabledReason: "nope" }),
      makeEntry({ id: "m.cmd", title: "Middle Command", enabled: true }),
    ];
    const scored = scorePaletteEntries(entries, "");
    assertEqual(scored.length, 3, "all entries should be returned");
    // Enabled first (Middle, Zebra) alphabetical, then disabled (Alpha)
    assertEqual(scored[0]?.entry.id, "m.cmd", "first enabled alphabetical");
    assertEqual(scored[1]?.entry.id, "z.cmd", "second enabled alphabetical");
    assertEqual(scored[2]?.entry.id, "a.cmd", "disabled entry last");
  });
}
