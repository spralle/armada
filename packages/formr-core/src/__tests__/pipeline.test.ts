import { describe, expect, it, vi } from 'vitest';
import { createForm } from '../create-form.js';
import { createStagePolicy } from '../stage-policy.js';
import type { Middleware, MiddlewareDecision, ValidatorAdapter } from '../contracts.js';
import type { ValidationIssue } from '../state.js';
import type { TransformDefinition } from '../transforms.js';

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

function createTracingMiddleware(log: string[]): Middleware<'draft' | 'submit' | 'approve'> {
  return {
    id: 'tracer',
    beforeAction: (ctx) => { log.push(`beforeAction:${ctx.action.type}`); return { action: 'continue' }; },
    afterAction: (ctx) => { log.push(`afterAction:${ctx.action.type}`); },
    beforeEvaluate: (ctx) => { log.push(`beforeEvaluate:${ctx.action.type}`); },
    afterEvaluate: (ctx) => { log.push(`afterEvaluate:${ctx.action.type}`); },
    beforeValidate: (ctx) => { log.push(`beforeValidate:${ctx.stage}`); },
    afterValidate: (ctx) => { log.push(`afterValidate:issues=${ctx.issues.length}`); },
    beforeSubmit: (ctx) => { log.push(`beforeSubmit:${ctx.submitContext.mode}`); return { action: 'continue' }; },
    afterSubmit: (ctx) => { log.push(`afterSubmit:ok=${ctx.result.ok}`); },
  };
}

describe('pipeline — 18-step engine', () => {
  it('set-value goes through all middleware hooks in order', () => {
    const log: string[] = [];
    const mw = createTracingMiddleware(log);
    const form = createForm({
      stagePolicy: createTestPolicy(),
      middleware: [mw],
      initialData: { name: '' },
    });

    form.setValue('name', 'Alice');

    expect(log).toEqual([
      'beforeAction:set-value',
      'beforeEvaluate:set-value',
      'afterEvaluate:set-value',
      'beforeValidate:draft',
      'afterValidate:issues=0',
      'afterAction:set-value',
    ]);
    expect((form.getState().data as Record<string, unknown>).name).toBe('Alice');
  });

  it('middleware beforeAction veto rolls back transaction', () => {
    const vetoMw: Middleware<'draft' | 'submit' | 'approve'> = {
      id: 'veto',
      beforeAction: () => ({ action: 'veto', reason: 'blocked' }),
    };
    const form = createForm({
      stagePolicy: createTestPolicy(),
      middleware: [vetoMw],
      initialData: { name: 'original' },
    });

    const result = form.setValue('name', 'changed');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('blocked');
    // State unchanged — rollback
    expect((form.getState().data as Record<string, unknown>).name).toBe('original');
  });

  it('middleware beforeSubmit veto rolls back', async () => {
    const vetoMw: Middleware<'draft' | 'submit' | 'approve'> = {
      id: 'submit-veto',
      beforeSubmit: () => ({ action: 'veto', reason: 'not ready' }),
    };
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, submitId: 'x' });
    const form = createForm({
      stagePolicy: createTestPolicy(),
      middleware: [vetoMw],
      onSubmit,
    });

    const result = await form.submit();

    expect(result.ok).toBe(false);
    expect(result.message).toBe('not ready');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('validators produce issues that are normalized and stored', () => {
    const validator: ValidatorAdapter<'draft' | 'submit' | 'approve'> = {
      id: 'test-validator',
      supports: () => true,
      validate: ({ stage }) => [{
        code: 'required',
        message: 'Name is required',
        severity: 'error',
        stage,
        path: { namespace: 'data', segments: ['name'] },
        source: { origin: 'function-validator', validatorId: 'test-validator' },
      }],
    };
    const form = createForm({
      stagePolicy: createTestPolicy(),
      validators: [validator],
      initialData: { name: '' },
    });

    form.setValue('name', '');

    const state = form.getState();
    expect(state.issues.length).toBe(1);
    expect(state.issues[0].code).toBe('required');
  });

  it('expression evaluation runs in the pipeline', () => {
    const engine = {
      id: 'test-engine',
      evaluate: () => null,
      evaluateRule: () => [{ path: 'computed', value: 42, mode: 'set' as const, ruleId: 'r1' }],
    };
    const form = createForm({
      stagePolicy: createTestPolicy(),
      expressionEngine: engine,
      rules: [{ id: 'r1', when: { kind: 'literal', value: true }, writes: [] }],
      initialData: { name: '', computed: 0 },
    });

    form.setValue('name', 'trigger');

    expect((form.getState().data as Record<string, unknown>).computed).toBe(42);
  });

  it('transform application (ingress + field)', () => {
    const transforms: TransformDefinition[] = [
      {
        id: 'trim',
        phase: 'ingress',
        transform: (value) => typeof value === 'string' ? value.trim() : value,
      },
      {
        id: 'upper',
        phase: 'field',
        transform: (value) => typeof value === 'string' ? value.toUpperCase() : value,
      },
    ];
    const form = createForm({
      stagePolicy: createTestPolicy(),
      transforms,
      initialData: { name: '' },
    });

    form.setValue('name', '  hello  ');

    expect((form.getState().data as Record<string, unknown>).name).toBe('HELLO');
  });

  it('submit with persistent mode updates meta.stage on success', async () => {
    const form = createForm({
      stagePolicy: createTestPolicy(),
      onSubmit: async () => ({ ok: true, submitId: 'test' }),
    });

    await form.submit({ requestedStage: 'submit', mode: 'persistent' });

    expect(form.getState().meta.stage).toBe('submit');
  });

  it('submit with transient mode does NOT update meta.stage', async () => {
    const form = createForm({
      stagePolicy: createTestPolicy(),
      onSubmit: async () => ({ ok: true, submitId: 'test' }),
    });

    await form.submit({ requestedStage: 'submit', mode: 'transient' });

    expect(form.getState().meta.stage).toBe('draft');
  });

  it('full action→commit cycle integration', () => {
    const log: string[] = [];
    const mw = createTracingMiddleware(log);
    const listener = vi.fn();
    const form = createForm({
      stagePolicy: createTestPolicy(),
      middleware: [mw],
      initialData: { x: 0 },
    });
    form.subscribe(listener);

    const result = form.dispatch({ type: 'set-value', path: 'x', value: 99 });

    expect(result.ok).toBe(true);
    expect((form.getState().data as Record<string, unknown>).x).toBe(99);
    // Subscriber notified (step 16)
    expect(listener).toHaveBeenCalledTimes(1);
    // All hooks fired
    expect(log.length).toBeGreaterThan(0);
    expect(log[0]).toBe('beforeAction:set-value');
    expect(log[log.length - 1]).toBe('afterAction:set-value');
  });

  it('all-or-nothing: error during pipeline rolls back', () => {
    // Use a veto hook (beforeAction) that throws to trigger rollback,
    // since notify hooks (beforeEvaluate) now swallow errors for reliability
    const badMw: Middleware<'draft' | 'submit' | 'approve'> = {
      id: 'crasher',
      beforeAction: () => { throw new Error('boom'); },
    };
    const form = createForm({
      stagePolicy: createTestPolicy(),
      middleware: [badMw],
      initialData: { x: 'safe' },
    });

    const result = form.setValue('x', 'danger');

    expect(result.ok).toBe(false);
    // Throwing veto hook is treated as veto
    expect((form.getState().data as Record<string, unknown>).x).toBe('safe');
  });

  it('multiple middleware run in registration order', () => {
    const log: string[] = [];
    const mw1: Middleware<'draft' | 'submit' | 'approve'> = {
      id: 'first',
      beforeAction: () => { log.push('first'); return { action: 'continue' }; },
    };
    const mw2: Middleware<'draft' | 'submit' | 'approve'> = {
      id: 'second',
      beforeAction: () => { log.push('second'); return { action: 'continue' }; },
    };
    const form = createForm({
      stagePolicy: createTestPolicy(),
      middleware: [mw1, mw2],
      initialData: { x: 0 },
    });

    form.setValue('x', 1);

    expect(log).toEqual(['first', 'second']);
  });

  it('submit pipeline calls afterSubmit hook', async () => {
    const log: string[] = [];
    const mw = createTracingMiddleware(log);
    const form = createForm({
      stagePolicy: createTestPolicy(),
      middleware: [mw],
      onSubmit: async () => ({ ok: true, submitId: 'test' }),
    });

    await form.submit();

    expect(log).toContain('beforeSubmit:persistent');
    expect(log).toContain('afterSubmit:ok=true');
  });

  it('validator issues block submit', async () => {
    const validator: ValidatorAdapter<'draft' | 'submit' | 'approve'> = {
      id: 'blocker',
      supports: () => true,
      validate: () => [{
        code: 'required',
        message: 'Required',
        severity: 'error',
        stage: 'draft' as const,
        path: { namespace: 'data' as const, segments: ['x'] },
        source: { origin: 'function-validator' as const, validatorId: 'blocker' },
      }],
    };
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, submitId: 'x' });
    const form = createForm({
      stagePolicy: createTestPolicy(),
      validators: [validator],
      onSubmit,
    });

    const result = await form.submit();

    expect(result.ok).toBe(false);
    expect(result.message).toBe('Validation failed');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
