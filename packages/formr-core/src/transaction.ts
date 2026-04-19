import type { FormState } from './state.js';
import { deepFreeze } from './utils.js';

export interface StateStrategy {
  readonly clone: <T>(value: T) => T;
  readonly freeze: <T>(value: T) => T;
}

export const defaultStrategy: StateStrategy = {
  clone: structuredClone,
  freeze: deepFreeze,
};

export interface TransactionSnapshot {
  readonly prevState: FormState;
  readonly draftState: FormState;
  readonly status: 'active' | 'committed' | 'rolled-back';
}

export class Transaction {
  private _prevState: FormState;
  private _draftState: FormState;
  private _status: 'active' | 'committed' | 'rolled-back' = 'active';
  private _dirty = false;

  constructor(currentState: FormState, strategy: StateStrategy = defaultStrategy) {
    this._prevState = strategy.freeze(strategy.clone(currentState));
    this._draftState = strategy.clone(currentState);
  }

  get prevState(): FormState {
    return this._prevState;
  }

  get draftState(): FormState {
    return this._draftState;
  }

  get status(): 'active' | 'committed' | 'rolled-back' {
    return this._status;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  /** Apply a mutation to the draft state */
  mutate(mutator: (draft: FormState) => FormState): void {
    if (this._status !== 'active') {
      throw new Error(`Cannot mutate ${this._status} transaction`);
    }
    this._draftState = mutator(this._draftState);
    this._dirty = true;
  }

  /** Commit — returns the final draft state */
  commit(): FormState {
    if (this._status !== 'active') {
      throw new Error(`Cannot commit ${this._status} transaction`);
    }
    this._status = 'committed';
    return this._draftState;
  }

  /** Rollback — discard all draft mutations, return original state */
  rollback(): FormState {
    if (this._status !== 'active') {
      throw new Error(`Cannot rollback ${this._status} transaction`);
    }
    this._status = 'rolled-back';
    return this._prevState;
  }
}
