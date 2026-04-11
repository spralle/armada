// Action palette state machine — pure state transitions and fuzzy scoring.
// No DOM, no React, no side effects. Deterministic: same input -> same output.

export interface ActionPaletteEntry {
  id: string;
  title: string;
  category: "action" | "intent" | "command";
  keybindingHint: string | null;
  enabled: boolean;
  disabledReason: string | null;
  pluginId: string;
}

export interface ScoredPaletteEntry {
  entry: ActionPaletteEntry;
  score: number;
}

export interface ActionPaletteState {
  phase: "closed" | "open";
  filter: string;
  selectedIndex: number;
  entries: readonly ActionPaletteEntry[];
  filteredEntries: readonly ScoredPaletteEntry[];
}

export type ActionPaletteAction =
  | { type: "open"; entries: readonly ActionPaletteEntry[] }
  | { type: "close" }
  | { type: "updateFilter"; filter: string }
  | { type: "selectNext" }
  | { type: "selectPrevious" }
  | { type: "selectIndex"; index: number };

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function createInitialPaletteState(): ActionPaletteState {
  return {
    phase: "closed",
    filter: "",
    selectedIndex: 0,
    entries: [],
    filteredEntries: [],
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reducePaletteState(
  state: ActionPaletteState,
  action: ActionPaletteAction,
): ActionPaletteState {
  switch (action.type) {
    case "open":
      return {
        phase: "open",
        filter: "",
        selectedIndex: 0,
        entries: action.entries,
        filteredEntries: scorePaletteEntries(action.entries, ""),
      };

    case "close":
      return createInitialPaletteState();

    case "updateFilter": {
      const filtered = scorePaletteEntries(state.entries, action.filter);
      return {
        ...state,
        filter: action.filter,
        filteredEntries: filtered,
        selectedIndex: 0,
      };
    }

    case "selectNext": {
      const maxIndex = Math.max(0, state.filteredEntries.length - 1);
      return {
        ...state,
        selectedIndex:
          state.selectedIndex >= maxIndex ? 0 : state.selectedIndex + 1,
      };
    }

    case "selectPrevious": {
      const maxIndex = Math.max(0, state.filteredEntries.length - 1);
      return {
        ...state,
        selectedIndex:
          state.selectedIndex <= 0 ? maxIndex : state.selectedIndex - 1,
      };
    }

    case "selectIndex":
      return {
        ...state,
        selectedIndex: Math.max(
          0,
          Math.min(action.index, state.filteredEntries.length - 1),
        ),
      };
  }
}

// ---------------------------------------------------------------------------
// Selected entry accessor
// ---------------------------------------------------------------------------

export function getSelectedEntry(
  state: ActionPaletteState,
): ActionPaletteEntry | null {
  return state.filteredEntries[state.selectedIndex]?.entry ?? null;
}

// ---------------------------------------------------------------------------
// Scoring / fuzzy matching
// ---------------------------------------------------------------------------

export function scorePaletteEntries(
  entries: readonly ActionPaletteEntry[],
  filter: string,
): ScoredPaletteEntry[] {
  if (!filter.trim()) {
    return [...entries]
      .sort((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
        return a.title.localeCompare(b.title);
      })
      .map((entry) => ({ entry, score: 1 }));
  }

  const needle = filter.toLowerCase();
  const scored: ScoredPaletteEntry[] = [];

  for (const entry of entries) {
    const score = computeFuzzyScore(entry, needle);
    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  return scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.entry.enabled !== b.entry.enabled)
      return a.entry.enabled ? -1 : 1;
    return a.entry.title.localeCompare(b.entry.title);
  });
}

/**
 * Compute a fuzzy relevance score for a palette entry against a lowercase needle.
 *
 * Scoring tiers:
 *   100 — title contains needle (case-insensitive)
 *    90 — title starts with needle
 *    70 — id contains needle
 *    50+  — title subsequence match (bonus for consecutive chars)
 *    30   — id subsequence match
 *     0   — no match
 *
 * Higher tiers are checked first and the best score is returned.
 */
export function computeFuzzyScore(
  entry: ActionPaletteEntry,
  needle: string,
): number {
  const titleLower = entry.title.toLowerCase();
  const idLower = entry.id.toLowerCase();

  // Exact contains in title — highest
  if (titleLower.includes(needle)) {
    // Distinguish prefix from generic substring
    return titleLower.startsWith(needle) ? 100 : 90;
  }

  // ID exact contains
  if (idLower.includes(needle)) {
    return 70;
  }

  // Title subsequence match
  const titleSubScore = subsequenceScore(titleLower, needle);
  if (titleSubScore > 0) {
    return 50 + titleSubScore;
  }

  // ID subsequence match
  const idSubScore = subsequenceScore(idLower, needle);
  if (idSubScore > 0) {
    return 30;
  }

  return 0;
}

/**
 * Returns a bonus score (0–20) for subsequence matching.
 * Each character in `needle` must appear in `haystack` in order.
 * Consecutive matching characters earn bonus points.
 */
function subsequenceScore(haystack: string, needle: string): number {
  let needleIdx = 0;
  let consecutive = 0;
  let bonus = 0;

  for (let i = 0; i < haystack.length && needleIdx < needle.length; i++) {
    if (haystack[i] === needle[needleIdx]) {
      needleIdx++;
      consecutive++;
      // Each consecutive char after the first adds a point (capped contribution)
      if (consecutive > 1) {
        bonus += 1;
      }
    } else {
      consecutive = 0;
    }
  }

  if (needleIdx < needle.length) {
    return 0; // not all characters matched
  }

  // Cap bonus to keep it within a sensible range
  return Math.min(bonus + 1, 20);
}
