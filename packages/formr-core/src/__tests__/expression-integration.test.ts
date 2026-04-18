import { describe, it, expect } from 'bun:test';
import { buildExpressionScope, evaluateExpressions, applyRuleWrites } from '../expression-integration.js';
import { createForm } from '../create-form.js';
import type { FormState } from '../state.js';
import type { ExpressionEngine, ExpressionScope, RuleDefinition, RuleWriteIntent, ExprNode } from '../contracts.js';

function makeState(overrides: Partial<FormState> = {}): FormState {
  return {
    data: overrides.data ?? {},
    uiState: overrides.uiState ?? {},
    meta: overrides.meta ?? { stage: 'draft', validation: {} },
    issues: overrides.issues ?? [],
  };
}

function createMockEngine(handler?: (rule: RuleDefinition, scope: ExpressionScope) => readonly RuleWriteIntent[]): ExpressionEngine {
  return {
    id: 'mock-engine',
    evaluate: () => null,
    evaluateRule: handler ?? (() => []),
  };
}

const dummyAst: ExprNode = { kind: 'literal', value: true };

describe('buildExpressionScope', () => {
  it('creates scope from FormState', () => {
    const state = makeState({ data: { name: 'Alice' }, uiState: { focused: true } });
    const scope = buildExpressionScope(state);

    expect(scope.data).toEqual({ name: 'Alice' });
    expect(scope.uiState).toEqual({ focused: true });
    expect(scope.meta).toEqual(state.meta);
  });
});

describe('evaluateExpressions', () => {
  it('returns writes from engine for each rule', () => {
    const rule: RuleDefinition = { id: 'r1', when: dummyAst, writes: [] };
    const write: RuleWriteIntent = { path: 'total', value: 42, mode: 'set', ruleId: 'r1' };
    const engine = createMockEngine(() => [write]);

    const result = evaluateExpressions(engine, makeState(), [rule]);
    expect(result).toEqual([write]);
  });

  it('aggregates writes from multiple rules', () => {
    const rules: RuleDefinition[] = [
      { id: 'r1', when: dummyAst, writes: [] },
      { id: 'r2', when: dummyAst, writes: [] },
    ];
    const engine = createMockEngine((rule) => [
      { path: `${rule.id}.out`, value: 1, mode: 'set' as const, ruleId: rule.id },
    ]);

    const result = evaluateExpressions(engine, makeState(), rules);
    expect(result).toHaveLength(2);
  });
});

describe('applyRuleWrites', () => {
  it('writes to data path update data', () => {
    const state = makeState({ data: { x: 1 } });
    const writes: RuleWriteIntent[] = [{ path: 'y', value: 2, mode: 'set', ruleId: 'r1' }];

    const result = applyRuleWrites(state, writes);
    expect(result.data).toEqual({ x: 1, y: 2 });
  });

  it('writes to $ui path update uiState', () => {
    const state = makeState({ uiState: { a: 1 } });
    const writes: RuleWriteIntent[] = [{ path: '$ui.visible', value: false, mode: 'set', ruleId: 'r1' }];

    const result = applyRuleWrites(state, writes);
    expect(result.uiState).toEqual({ a: 1, visible: false });
  });

  it('writes to nested data path', () => {
    const state = makeState({ data: { address: { city: 'NYC' } } });
    const writes: RuleWriteIntent[] = [{ path: 'address.zip', value: '10001', mode: 'set', ruleId: 'r1' }];

    const result = applyRuleWrites(state, writes);
    expect(result.data).toEqual({ address: { city: 'NYC', zip: '10001' } });
  });

  it('delete mode removes data path', () => {
    const state = makeState({ data: { x: 1, y: 2 } });
    const writes: RuleWriteIntent[] = [{ path: 'y', value: undefined, mode: 'delete', ruleId: 'r1' }];

    const result = applyRuleWrites(state, writes);
    expect(result.data).toEqual({ x: 1 });
  });

  it('delete mode removes $ui path', () => {
    const state = makeState({ uiState: { a: 1, b: 2 } });
    const writes: RuleWriteIntent[] = [{ path: '$ui.b', value: undefined, mode: 'delete', ruleId: 'r1' }];

    const result = applyRuleWrites(state, writes);
    expect(result.uiState).toEqual({ a: 1 });
  });

  it('does not mutate original state', () => {
    const state = makeState({ data: { x: 1 } });
    const writes: RuleWriteIntent[] = [{ path: 'x', value: 99, mode: 'set', ruleId: 'r1' }];

    const result = applyRuleWrites(state, writes);
    expect(state.data).toEqual({ x: 1 });
    expect(result.data).toEqual({ x: 99 });
  });
});

describe('createForm with expressionEngine', () => {
  it('forms without expressionEngine skip evaluation (no error)', () => {
    const form = createForm({ initialData: { x: 1 } });
    const result = form.setValue('x', 2);
    expect(result.ok).toBe(true);
    expect(form.getState().data).toEqual({ x: 2 });
    form.dispose();
  });

  it('setValue triggers expression evaluation with mock engine', () => {
    const engine = createMockEngine((_rule, scope) => {
      const data = scope.data as Record<string, unknown>;
      const price = (data.price as number) ?? 0;
      const qty = (data.qty as number) ?? 0;
      return [{ path: 'total', value: price * qty, mode: 'set' as const, ruleId: 'calc' }];
    });

    const rules: RuleDefinition[] = [
      { id: 'calc', when: dummyAst, writes: [] },
    ];

    const form = createForm({
      initialData: { price: 10, qty: 0, total: 0 },
      expressionEngine: engine,
      rules,
    });

    form.setValue('qty', 5);
    expect((form.getState().data as Record<string, unknown>).total).toBe(50);

    form.setValue('price', 20);
    expect((form.getState().data as Record<string, unknown>).total).toBe(100);

    form.dispose();
  });

  it('expression engine writing to $ui path works in dispatch cycle', () => {
    const engine = createMockEngine((_rule, scope) => {
      const data = scope.data as Record<string, unknown>;
      return [{ path: '$ui.showTotal', value: (data.qty as number) > 0, mode: 'set' as const, ruleId: 'vis' }];
    });

    const rules: RuleDefinition[] = [{ id: 'vis', when: dummyAst, writes: [] }];

    const form = createForm({
      initialData: { qty: 0 },
      expressionEngine: engine,
      rules,
    });

    form.setValue('qty', 3);
    expect((form.getState().uiState as Record<string, unknown>).showTotal).toBe(true);

    form.dispose();
  });
});
