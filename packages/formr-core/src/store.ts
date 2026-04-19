import type { FormState } from './state.js';
import { Transaction, type StateStrategy, defaultStrategy } from './transaction.js';

export type StateListener = (
  state: FormState,
) => void;

/** Synchronous reactive store with transactional semantics — only one transaction active at a time. */
export class FormStore {
  private _state: FormState;
  private _listeners: Set<StateListener> = new Set();
  private _activeTransaction: Transaction | null = null;
  private _strategy: StateStrategy;

  constructor(initialState: FormState, strategy?: StateStrategy) {
    this._state = initialState;
    this._strategy = strategy ?? defaultStrategy;
  }

  /** Return the current frozen state snapshot. */
  getState(): FormState {
    return this._state;
  }

  /** Clone current state into a mutable draft context. Only one transaction may be active at a time. */
  beginTransaction(): Transaction {
    if (this._activeTransaction) {
      throw new Error('Cannot begin transaction while another is active');
    }
    this._activeTransaction = new Transaction(this._state, this._strategy);
    return this._activeTransaction;
  }

  /** Apply draft state and notify subscribers if state was mutated. */
  commitTransaction(tx: Transaction): void {
    if (tx !== this._activeTransaction) {
      throw new Error('Transaction does not belong to this store');
    }
    const nextState = tx.commit();
    this._activeTransaction = null;

    if (!tx.dirty) {
      return;
    }

    this._state = nextState;
    this._notifyListeners();
  }

  /** Discard draft state without notifying subscribers. */
  rollbackTransaction(tx: Transaction): void {
    if (tx !== this._activeTransaction) {
      throw new Error('Transaction does not belong to this store');
    }
    tx.rollback();
    this._activeTransaction = null;
  }

  /** Register a listener called on each commit. Returns an unsubscribe function. */
  subscribe(listener: StateListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /** Clear all subscriptions and roll back any active transaction. */
  dispose(): void {
    this._listeners.clear();
    if (this._activeTransaction && this._activeTransaction.status === 'active') {
      this._activeTransaction.rollback();
    }
    this._activeTransaction = null;
  }

  private _notifyListeners(): void {
    const state = this._state;
    for (const listener of this._listeners) {
      try {
        listener(state);
      } catch {
        // Swallow subscriber errors to ensure all listeners are notified
      }
    }
  }
}
