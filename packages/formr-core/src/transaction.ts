import type { FormState } from './state.js';
import { deepFreeze } from './utils.js';

export interface TransactionSnapshot<S extends string = string> {
  readonly prevState: FormState<S>;
  readonly draftState: FormState<S>;
  readonly status: 'active' | 'committed' | 'rolled-back';
}

export class Transaction<S extends string = string> {
  private _prevState: FormState<S>;
  private _draftState: FormState<S>;
  private _status: 'active' | 'committed' | 'rolled-back' = 'active';
  private _dirty = false;

  constructor(currentState: FormState<S>) {
    this._prevState = deepFreeze(structuredClone(currentState));
    this._draftState = structuredClone(currentState);
  }

  get prevState(): FormState<S> {
    return this._prevState;
  }

  get draftState(): FormState<S> {
    return this._draftState;
  }

  get status(): 'active' | 'committed' | 'rolled-back' {
    return this._status;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  /** Apply a mutation to the draft state */
  mutate(mutator: (draft: FormState<S>) => FormState<S>): void {
    if (this._status !== 'active') {
      throw new Error(`Cannot mutate ${this._status} transaction`);
    }
    this._draftState = mutator(this._draftState);
    this._dirty = true;
  }

  /** Commit — returns the final draft state */
  commit(): FormState<S> {
    if (this._status !== 'active') {
      throw new Error(`Cannot commit ${this._status} transaction`);
    }
    this._status = 'committed';
    return this._draftState;
  }

  /** Rollback — discard all draft mutations, return original state */
  rollback(): FormState<S> {
    if (this._status !== 'active') {
      throw new Error(`Cannot rollback ${this._status} transaction`);
    }
    this._status = 'rolled-back';
    return this._prevState;
  }
}
