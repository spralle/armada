import { describe, expect, it } from 'bun:test';
import {
  createDefaultStagePolicy,
  createStagePolicy,
  assertKnownStage,
} from '../stage-policy.js';
import { resolveActiveStage, applySubmitOutcome } from '../submit.js';
import { FormrError } from '../errors.js';
import type { FormState, SubmitContext } from '../state.js';

describe('createDefaultStagePolicy', () => {
  const policy = createDefaultStagePolicy();

  it('has correct ordered stages', () => {
    expect(policy.orderedStages).toEqual(['draft', 'submit', 'approve']);
    expect(policy.defaultStage).toBe('draft');
  });

  it('allows valid transitions', () => {
    expect(policy.canTransition('draft', 'submit')).toBe(true);
    expect(policy.canTransition('submit', 'approve')).toBe(true);
    expect(policy.canTransition('submit', 'draft')).toBe(true);
    expect(policy.canTransition('approve', 'submit')).toBe(true);
  });

  it('rejects draft->approve (not allowed)', () => {
    expect(policy.canTransition('draft', 'approve')).toBe(false);
  });

  it('describes transitions with reasons', () => {
    const rule = policy.describeTransition('submit', 'draft');
    expect(rule).toEqual({ from: 'submit', to: 'draft', reason: 'Return to draft' });

    const noRule = policy.describeTransition('draft', 'approve');
    expect(noRule).toBeNull();
  });

  it('identifies known and unknown stages', () => {
    expect(policy.isKnownStage('draft')).toBe(true);
    expect(policy.isKnownStage('unknown')).toBe(false);
  });
});

describe('assertKnownStage', () => {
  const policy = createDefaultStagePolicy();

  it('throws FORMR_STAGE_UNKNOWN for unknown stage', () => {
    expect(() => assertKnownStage(policy, 'bogus')).toThrow(FormrError);
    try {
      assertKnownStage(policy, 'bogus');
    } catch (e) {
      expect(e).toBeInstanceOf(FormrError);
      expect((e as FormrError).code).toBe('FORMR_STAGE_UNKNOWN');
      expect((e as FormrError).message).toContain('bogus');
    }
  });

  it('does not throw for known stage', () => {
    expect(() => assertKnownStage(policy, 'draft')).not.toThrow();
  });
});

describe('createStagePolicy', () => {
  it('works with arbitrary stages', () => {
    const policy = createStagePolicy({
      orderedStages: ['open', 'closed'] as const,
      defaultStage: 'open',
      transitions: [{ from: 'open', to: 'closed' }],
    });

    expect(policy.orderedStages).toEqual(['open', 'closed']);
    expect(policy.defaultStage).toBe('open');
    expect(policy.canTransition('open', 'closed')).toBe(true);
    expect(policy.canTransition('closed', 'open')).toBe(false);
    expect(policy.isKnownStage('open')).toBe(true);
    expect(policy.isKnownStage('nope')).toBe(false);
  });
});

type TestStages = 'draft' | 'submit' | 'approve';

function makeMeta(stage: TestStages): FormState<TestStages>['meta'] {
  return {
    stage,
    validation: {},
  };
}

function makeSubmitContext(
  mode: 'persistent' | 'transient',
  requestedStage: TestStages,
): SubmitContext<TestStages> {
  return {
    requestedStage,
    mode,
    requestId: 'req-1',
    at: new Date().toISOString(),
  };
}

describe('resolveActiveStage', () => {
  it('returns meta.stage when no submit context', () => {
    const meta = makeMeta('draft');
    expect(resolveActiveStage(meta, undefined)).toBe('draft');
  });

  it('returns meta.stage for persistent mode', () => {
    const meta = makeMeta('draft');
    const ctx = makeSubmitContext('persistent', 'submit');
    expect(resolveActiveStage(meta, ctx)).toBe('draft');
  });

  it('returns requestedStage for transient mode', () => {
    const meta = makeMeta('draft');
    const ctx = makeSubmitContext('transient', 'submit');
    expect(resolveActiveStage(meta, ctx)).toBe('submit');
  });
});

describe('applySubmitOutcome', () => {
  it('persistent success sets meta.stage = requestedStage', () => {
    const meta = makeMeta('draft');
    const ctx = makeSubmitContext('persistent', 'submit');
    const result = applySubmitOutcome(meta, ctx, true, 'sid-1');
    expect(result.stage).toBe('submit');
    expect(result.submission?.status).toBe('succeeded');
    expect(result.validation.lastEvaluatedStage).toBe('submit');
  });

  it('persistent failure keeps meta.stage unchanged', () => {
    const meta = makeMeta('draft');
    const ctx = makeSubmitContext('persistent', 'submit');
    const result = applySubmitOutcome(meta, ctx, false, 'sid-2');
    expect(result.stage).toBe('draft');
    expect(result.submission?.status).toBe('failed');
    expect(result.validation.lastEvaluatedStage).toBe('submit');
  });

  it('transient success never mutates meta.stage', () => {
    const meta = makeMeta('draft');
    const ctx = makeSubmitContext('transient', 'submit');
    const result = applySubmitOutcome(meta, ctx, true, 'sid-3');
    expect(result.stage).toBe('draft');
    expect(result.submission?.status).toBe('succeeded');
    expect(result.validation.lastEvaluatedStage).toBe('submit');
  });

  it('transient failure never mutates meta.stage', () => {
    const meta = makeMeta('draft');
    const ctx = makeSubmitContext('transient', 'submit');
    const result = applySubmitOutcome(meta, ctx, false, 'sid-4');
    expect(result.stage).toBe('draft');
    expect(result.submission?.status).toBe('failed');
    expect(result.validation.lastEvaluatedStage).toBe('submit');
  });

  it('all outcomes set lastEvaluatedStage = requestedStage', () => {
    const meta = makeMeta('draft');
    const cases = [
      { mode: 'persistent' as const, success: true },
      { mode: 'persistent' as const, success: false },
      { mode: 'transient' as const, success: true },
      { mode: 'transient' as const, success: false },
    ];
    for (const { mode, success } of cases) {
      const ctx = makeSubmitContext(mode, 'approve');
      const result = applySubmitOutcome(meta, ctx, success, 'sid');
      expect(result.validation.lastEvaluatedStage).toBe('approve');
    }
  });
});
