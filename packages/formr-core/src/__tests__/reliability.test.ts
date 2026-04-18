import { describe, it, expect, mock } from 'bun:test';
import { FormStore } from '../store.js';
import { createForm } from '../create-form.js';
import { createStagePolicy } from '../stage-policy.js';
import { runNotifyHooksSync } from '../middleware-runner.js';
import type { FormState, ValidationIssue } from '../state.js';
import type { Middleware, ValidatorAdapter } from '../contracts.js';

type Stages = 'draft' | 'submit' | 'approve';

function makeState(data: unknown = {}): FormState<Stages> {
  return {
    data,
    uiState: {},
    meta: { stage: 'draft', validation: {} },
    issues: [],
  };
}

function createTestPolicy() {
  return createStagePolicy({
    orderedStages: ['draft', 'submit', 'approve'] as const,
    defaultStage: 'draft',
    transitions: [
      { from: 'draft', to: 'submit' },
      { from: 'submit', to: 'approve' },
    ],
  });
}

describe('reliability — subscriber error isolation', () => {
  it('throwing subscriber does not prevent other subscribers from being notified', () => {
    const store = new FormStore<Stages>(makeState({ x: 0 }));
    const calls: string[] = [];

    store.subscribe(() => { calls.push('first'); });
    store.subscribe(() => { throw new Error('boom'); });
    store.subscribe(() => { calls.push('third'); });

    const tx = store.beginTransaction();
    tx.mutate((s) => ({ ...s, data: { x: 1 } }));
    store.commitTransaction(tx);

    expect(calls).toEqual(['first', 'third']);
  });
});

describe('reliability — validation issues cleared between dispatches', () => {
  it('issues do not accumulate across dispatches', () => {
    let shouldFail = true;
    const validator: ValidatorAdapter<Stages> = {
      id: 'conditional',
      supports: () => true,
      validate: ({ data }) => {
        if (!shouldFail) return [];
        return [{
          code: 'required',
          message: 'Required',
          severity: 'error' as const,
          stage: 'draft' as const,
          path: { namespace: 'data' as const, segments: ['name'] },
          source: { origin: 'function-validator' as const, validatorId: 'conditional' },
        }];
      },
    };
    const form = createForm({
      stagePolicy: createTestPolicy(),
      validators: [validator],
      initialData: { name: '' },
    });

    // First dispatch — produces 1 issue
    form.setValue('name', '');
    expect(form.getState().issues.length).toBe(1);

    // Second dispatch — validator returns no issues; stale issues must be cleared
    shouldFail = false;
    form.setValue('name', 'valid');
    expect(form.getState().issues.length).toBe(0);
  });
});

describe('reliability — sync notify hook error isolation', () => {
  it('throwing sync notify hook does not crash the pipeline', () => {
    const crashMw: Middleware<Stages> = {
      id: 'crasher',
      beforeEvaluate: () => { throw new Error('notify boom'); },
    };
    const form = createForm({
      stagePolicy: createTestPolicy(),
      middleware: [crashMw],
      initialData: { x: 0 },
    });

    const result = form.setValue('x', 42);

    // Pipeline should succeed despite the throwing notify hook
    expect(result.ok).toBe(true);
    expect((form.getState().data as Record<string, unknown>).x).toBe(42);
  });

  it('throwing sync notify hook does not skip remaining hooks', () => {
    const calls: string[] = [];
    const crashMw: Middleware<Stages> = {
      id: 'crasher',
      afterAction: () => { throw new Error('boom'); },
    };
    const trackerMw: Middleware<Stages> = {
      id: 'tracker',
      afterAction: () => { calls.push('tracker'); },
    };
    const form = createForm({
      stagePolicy: createTestPolicy(),
      middleware: [crashMw, trackerMw],
      initialData: { x: 0 },
    });

    form.setValue('x', 1);
    expect(calls).toEqual(['tracker']);
  });
});
