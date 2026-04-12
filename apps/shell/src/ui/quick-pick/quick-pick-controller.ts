// QuickPick controller — implements the QuickPick<T> interface from ghost-api.ts.
// Bridges the state machine with the event system for plugin consumers.

import type { QuickPick, QuickPickItem } from "@ghost/plugin-contracts";
import { createEventEmitter } from "@ghost/plugin-contracts";
import type { QuickPickAction, QuickPickState } from "./quick-pick-state.js";
import {
  createInitialQuickPickState,
  reduceQuickPickState,
  getSelectedItem,
} from "./quick-pick-state.js";

/** Internal interface extending QuickPick with shell-side accessors. */
export interface QuickPickController<T extends QuickPickItem>
  extends QuickPick<T> {
  /** Get the current state for rendering. */
  getState(): QuickPickState<T>;
  /** Dispatch a state action (used by the overlay). */
  dispatch(action: QuickPickAction<T>): void;
  /** Fire the accept event (called by the overlay on Enter). */
  fireAccept(): void;
}

export function createQuickPickController<
  T extends QuickPickItem,
>(): QuickPickController<T> {
  let state = createInitialQuickPickState<T>();
  let disposed = false;

  const valueEmitter = createEventEmitter<string>();
  const activeEmitter = createEventEmitter<readonly T[]>();
  const acceptEmitter = createEventEmitter<void>();
  const hideEmitter = createEventEmitter<void>();

  let placeholderValue = "";

  function applyState(next: QuickPickState<T>): void {
    const prevSelectedItem = getSelectedItem(state);
    state = next;
    const newSelectedItem = getSelectedItem(state);

    // Fire onDidChangeActive when the active item changes
    if (prevSelectedItem !== newSelectedItem) {
      const active = newSelectedItem ? [newSelectedItem] : [];
      activeEmitter.fire(active);
    }
  }

  const controller: QuickPickController<T> = {
    // --- items ---
    get items(): T[] {
      return [...state.items];
    },
    set items(newItems: T[]) {
      if (disposed) return;
      applyState(
        reduceQuickPickState(state, { type: "setItems", items: newItems }),
      );
    },

    // --- activeItems ---
    get activeItems(): readonly T[] {
      const selected = getSelectedItem(state);
      return selected ? [selected] : [];
    },

    // --- value ---
    get value(): string {
      return state.filter;
    },
    set value(newValue: string) {
      if (disposed) return;
      applyState(
        reduceQuickPickState(state, {
          type: "updateFilter",
          filter: newValue,
        }),
      );
      valueEmitter.fire(newValue);
    },

    // --- placeholder ---
    get placeholder(): string {
      return placeholderValue;
    },
    set placeholder(newPlaceholder: string) {
      placeholderValue = newPlaceholder;
    },

    // --- Events ---
    onDidChangeValue: valueEmitter.event,
    onDidChangeActive: activeEmitter.event,
    onDidAccept: acceptEmitter.event,
    onDidHide: hideEmitter.event,

    // --- Lifecycle ---
    show(): void {
      if (disposed) return;
      if (state.phase === "open") return;
      applyState(
        reduceQuickPickState(state, {
          type: "open",
          items: state.items,
          scoringOptions: state.scoringOptions,
        }),
      );
    },

    hide(): void {
      if (disposed) return;
      if (state.phase === "closed") return;
      applyState(reduceQuickPickState(state, { type: "close" }));
      hideEmitter.fire();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (state.phase === "open") {
        state = createInitialQuickPickState<T>();
        hideEmitter.fire();
      }
      valueEmitter.dispose();
      activeEmitter.dispose();
      acceptEmitter.dispose();
      hideEmitter.dispose();
    },

    // --- Shell-internal ---
    getState(): QuickPickState<T> {
      return state;
    },

    dispatch(action: QuickPickAction<T>): void {
      if (disposed) return;

      if (action.type === "updateFilter") {
        applyState(reduceQuickPickState(state, action));
        valueEmitter.fire(action.filter);
        return;
      }

      applyState(reduceQuickPickState(state, action));
    },

    fireAccept(): void {
      if (disposed) return;
      acceptEmitter.fire();
    },
  };

  return controller;
}
