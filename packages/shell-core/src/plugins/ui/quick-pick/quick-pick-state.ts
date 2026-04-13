// QuickPick state machine — pure state transitions and fuzzy scoring.
// Generalized from action-palette-state.ts to work with generic QuickPickItem.
// No DOM, no React, no side effects. Deterministic: same input -> same output.

import type { QuickPickItem } from "@ghost-shell/plugin-contracts";

// ---------------------------------------------------------------------------
// Options for scoring behavior
// ---------------------------------------------------------------------------

export interface QuickPickScoringOptions {
  /** Whether to match the filter against item.description. */
  matchOnDescription?: boolean;
  /** Whether to match the filter against item.detail. */
  matchOnDetail?: boolean;
}

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

export interface ScoredQuickPickItem<T extends QuickPickItem> {
  item: T;
  score: number;
}

export interface QuickPickState<T extends QuickPickItem> {
  phase: "closed" | "open";
  filter: string;
  selectedIndex: number;
  items: readonly T[];
  filteredItems: readonly ScoredQuickPickItem<T>[];
  scoringOptions: QuickPickScoringOptions;
}

export type QuickPickAction<T extends QuickPickItem> =
  | { type: "open"; items: readonly T[]; scoringOptions?: QuickPickScoringOptions }
  | { type: "close" }
  | { type: "setItems"; items: readonly T[] }
  | { type: "updateFilter"; filter: string }
  | { type: "selectNext" }
  | { type: "selectPrevious" }
  | { type: "selectIndex"; index: number };

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function createInitialQuickPickState<
  T extends QuickPickItem,
>(): QuickPickState<T> {
  return {
    phase: "closed",
    filter: "",
    selectedIndex: 0,
    items: [],
    filteredItems: [],
    scoringOptions: {},
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reduceQuickPickState<T extends QuickPickItem>(
  state: QuickPickState<T>,
  action: QuickPickAction<T>,
): QuickPickState<T> {
  switch (action.type) {
    case "open": {
      const opts = action.scoringOptions ?? {};
      return {
        phase: "open",
        filter: "",
        selectedIndex: 0,
        items: action.items,
        filteredItems: scoreQuickPickItems(action.items, "", opts),
        scoringOptions: opts,
      };
    }

    case "close":
      return createInitialQuickPickState();

    case "setItems": {
      const filtered = scoreQuickPickItems(
        action.items,
        state.filter,
        state.scoringOptions,
      );
      return {
        ...state,
        items: action.items,
        filteredItems: filtered,
        selectedIndex: 0,
      };
    }

    case "updateFilter": {
      const filtered = scoreQuickPickItems(
        state.items,
        action.filter,
        state.scoringOptions,
      );
      return {
        ...state,
        filter: action.filter,
        filteredItems: filtered,
        selectedIndex: 0,
      };
    }

    case "selectNext": {
      const maxIndex = Math.max(0, state.filteredItems.length - 1);
      return {
        ...state,
        selectedIndex:
          state.selectedIndex >= maxIndex ? 0 : state.selectedIndex + 1,
      };
    }

    case "selectPrevious": {
      const maxIndex = Math.max(0, state.filteredItems.length - 1);
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
          Math.min(action.index, state.filteredItems.length - 1),
        ),
      };
  }
}

// ---------------------------------------------------------------------------
// Selected item accessor
// ---------------------------------------------------------------------------

export function getSelectedItem<T extends QuickPickItem>(
  state: QuickPickState<T>,
): T | null {
  return state.filteredItems[state.selectedIndex]?.item ?? null;
}

// ---------------------------------------------------------------------------
// Scoring / fuzzy matching
// ---------------------------------------------------------------------------

export function scoreQuickPickItems<T extends QuickPickItem>(
  items: readonly T[],
  filter: string,
  options?: QuickPickScoringOptions,
): ScoredQuickPickItem<T>[] {
  if (!filter.trim()) {
    return [...items]
      .sort((a, b) => {
        const aEnabled = a.enabled !== false;
        const bEnabled = b.enabled !== false;
        if (aEnabled !== bEnabled) return aEnabled ? -1 : 1;
        return a.label.localeCompare(b.label);
      })
      .map((item) => ({ item, score: 1 }));
  }

  const needle = filter.toLowerCase();
  const scored: ScoredQuickPickItem<T>[] = [];

  for (const item of items) {
    const score = computeFuzzyScore(item, needle, options);
    if (score > 0) {
      scored.push({ item, score });
    }
  }

  return scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const aEnabled = a.item.enabled !== false;
    const bEnabled = b.item.enabled !== false;
    if (aEnabled !== bEnabled) return aEnabled ? -1 : 1;
    return a.item.label.localeCompare(b.item.label);
  });
}

/**
 * Compute a fuzzy relevance score for a quick pick item against a lowercase needle.
 *
 * Scoring tiers:
 *   100 — label starts with needle (case-insensitive)
 *    90 — label contains needle
 *    70 — description contains needle (if matchOnDescription)
 *    60 — detail contains needle (if matchOnDetail)
 *    50+  — label subsequence match (bonus for consecutive chars)
 *    30   — description/detail subsequence match
 *     0   — no match
 *
 * Higher tiers are checked first and the best score is returned.
 */
export function computeFuzzyScore<T extends QuickPickItem>(
  item: T,
  needle: string,
  options?: QuickPickScoringOptions,
): number {
  const labelLower = item.label.toLowerCase();

  // Exact contains in label — highest
  if (labelLower.includes(needle)) {
    return labelLower.startsWith(needle) ? 100 : 90;
  }

  // Description exact contains
  if (options?.matchOnDescription && item.description) {
    if (item.description.toLowerCase().includes(needle)) {
      return 70;
    }
  }

  // Detail exact contains
  if (options?.matchOnDetail && item.detail) {
    if (item.detail.toLowerCase().includes(needle)) {
      return 60;
    }
  }

  // Label subsequence match
  const labelSubScore = subsequenceScore(labelLower, needle);
  if (labelSubScore > 0) {
    return 50 + labelSubScore;
  }

  // Description/detail subsequence match
  if (options?.matchOnDescription && item.description) {
    const descSubScore = subsequenceScore(
      item.description.toLowerCase(),
      needle,
    );
    if (descSubScore > 0) {
      return 30;
    }
  }

  if (options?.matchOnDetail && item.detail) {
    const detailSubScore = subsequenceScore(item.detail.toLowerCase(), needle);
    if (detailSubScore > 0) {
      return 30;
    }
  }

  return 0;
}

/**
 * Returns a bonus score (0–20) for subsequence matching.
 * Each character in `needle` must appear in `haystack` in order.
 * Consecutive matching characters earn bonus points.
 */
export function subsequenceScore(haystack: string, needle: string): number {
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
