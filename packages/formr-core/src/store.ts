import type { FormState } from './state.js';
import { Transaction } from './transaction.js';

export type StateListener<S extends string = string> = (
  state: FormState<S>,
) => void;

export class FormStore<S extends string = string> {
  private _state: FormState<S>;
  private _listeners: Set<StateListener<S>> = new Set();
  private _activeTransaction: Transaction<S> | null = null;

  constructor(initialState: FormState<S>) {
    this._state = initialState;
  }

  getState(): FormState<S> {
    return this._state;
  }

  /** Begin a new transaction */
  beginTransaction(): Transaction<S> {
    if (this._activeTransaction) {
      throw new Error('Cannot begin transaction while another is active');
    }
    this._activeTransaction = new Transaction(this._state);
    return this._activeTransaction;
  }

  /** Commit the active transaction and notify subscribers */
  commitTransaction(tx: Transaction<S>): void {
    if (tx !== this._activeTransaction) {
      throw new Error('Transaction does not belong to this store');
    }
    const nextState = tx.commit();
    const prevState = this._state;
    this._activeTransaction = null;

    if (!tx.dirty) {
      return;
    }

    this._state = nextState;
    this._notifyListeners();
  }

  /** Rollback the active transaction */
  rollbackTransaction(tx: Transaction<S>): void {
    if (tx !== this._activeTransaction) {
      throw new Error('Transaction does not belong to this store');
    }
    tx.rollback();
    this._activeTransaction = null;
  }

  /** Subscribe to state changes; returns unsubscribe function */
  subscribe(listener: StateListener<S>): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /** Dispose all subscriptions and clear active transaction */
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
