import { describe, test, expect } from 'bun:test';
import {
  createDefaultStagePolicy,
  createStagePolicy,
  assertKnownStage,
  applySubmitOutcome,
} from '../index.js';
import { FormrError } from '../errors.js';
import type { FormState, SubmitContext } from '../index.js';

function makeMeta<S extends string>(stage: S): FormState<S>['meta'] {
  return { stage, validation: {} };
}

describe('F2: Stage policy conformance', () => {
  const policy = createDefaultStagePolicy();

  test('F2.01: default profile has stages [draft, submit, approve]', () => {
    expect([...policy.orderedStages]).toEqual(['draft', 'submit', 'approve']);
  });

  test('F2.02: default stage is draft', () => {
    expect(policy.defaultStage).toBe('draft');
  });

  test('F2.03: isKnownStage(draft) → true', () => {
    expect(policy.isKnownStage('draft')).toBe(true);
  });

  test('F2.04: isKnownStage(unknown) → false', () => {
    expect(policy.isKnownStage('unknown')).toBe(false);
  });

  test('F2.05: canTransition(draft, submit) → true', () => {
    expect(policy.canTransition('draft', 'submit')).toBe(true);
  });

  test('F2.06: canTransition(draft, approve) → false', () => {
    expect(policy.canTransition('draft', 'approve')).toBe(false);
  });

  test('F2.07: canTransition(submit, draft) → true (return to draft)', () => {
    expect(policy.canTransition('submit', 'draft')).toBe(true);
  });

  test('F2.08: canTransition(approve, submit) → true (reopen)', () => {
    expect(policy.canTransition('approve', 'submit')).toBe(true);
  });

  test('F2.09: assertKnownStage with unknown stage throws FORMR_STAGE_UNKNOWN', () => {
    expect(() => assertKnownStage(policy, 'bogus')).toThrow(FormrError);
    try {
      assertKnownStage(policy, 'bogus');
    } catch (err) {
      expect((err as FormrError).code).toBe('FORMR_STAGE_UNKNOWN');
    }
  });

  test('F2.10: custom stage policy via createStagePolicy()', () => {
    const custom = createStagePolicy({
      orderedStages: ['open', 'closed'] as const,
      defaultStage: 'open',
      transitions: [{ from: 'open', to: 'closed' }],
    });
    expect(custom.defaultStage).toBe('open');
    expect(custom.canTransition('open', 'closed')).toBe(true);
    expect(custom.canTransition('closed', 'open')).toBe(false);
    expect(custom.isKnownStage('open')).toBe(true);
    expect(custom.isKnownStage('nope')).toBe(false);
  });

  test('F2.11: describeTransition returns rule for valid, null for invalid', () => {
    const rule = policy.describeTransition('draft', 'submit');
    expect(rule).not.toBeNull();
    expect(rule!.from).toBe('draft');
    expect(rule!.to).toBe('submit');

    const invalid = policy.describeTransition('draft', 'approve');
    expect(invalid).toBeNull();
  });

  test('F2.12: transient submit does NOT mutate meta.stage', () => {
    const meta = makeMeta('draft' as const);
    const ctx: SubmitContext<'draft' | 'submit' | 'approve'> = {
      requestedStage: 'submit',
      mode: 'transient',
      requestId: 'r1',
      at: new Date().toISOString(),
    };
    const result = applySubmitOutcome(meta, ctx, true, 'sid-1');
    expect(result.stage).toBe('draft');
  });

  test('F2.13: persistent submit success DOES mutate meta.stage', () => {
    const meta = makeMeta('draft' as const);
    const ctx: SubmitContext<'draft' | 'submit' | 'approve'> = {
      requestedStage: 'submit',
      mode: 'persistent',
      requestId: 'r2',
      at: new Date().toISOString(),
    };
    const result = applySubmitOutcome(meta, ctx, true, 'sid-2');
    expect(result.stage).toBe('submit');
  });

  test('F2.14: persistent submit failure does NOT mutate meta.stage', () => {
    const meta = makeMeta('draft' as const);
    const ctx: SubmitContext<'draft' | 'submit' | 'approve'> = {
      requestedStage: 'submit',
      mode: 'persistent',
      requestId: 'r3',
      at: new Date().toISOString(),
    };
    const result = applySubmitOutcome(meta, ctx, false, 'sid-3');
    expect(result.stage).toBe('draft');
  });
});
