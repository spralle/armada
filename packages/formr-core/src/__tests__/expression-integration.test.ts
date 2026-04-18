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

function createMockEngine(): ExpressionEngine {
  return {
    id: 'mock-engine',
    evaluate: (node: ExprNode, scope: ExpressionScope) => {
      if (node.kind === 'literal') return node.value;
      return null;
    },
  };
}

const dummyAst: ExprNode = { kind: 'literal', value: true };

describe('buildExpressionScope', () => {
  it('creates scope from FormState', () => {
    const state = makeState({ data: { name: 'Alice' }, uiState: { focused: true } });
    const scope = buildExpressionScope(state);

    expect(scope.name).toBe('Alice');
    expect(scope.$ui).toEqual({ focused: true });
    expect(scope.$meta).toEqual(state.meta);
  });
});

describe('evaluateExpressions', () => {
  it('returns writes from engine for a rule that fires', () => {
    const rule: RuleDefinition = {
      id: 'r1',
      when: { kind: 'literal', value: true },
      writes: [{ path: 'total', value: { kind: 'literal', value: 42 }, mode: 'set' }],
    };
    const engine = createMockEngine();

    const result = evaluateExpressions(engine, makeState(), [rule]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ path: 'total', value: 42, mode: 'set', ruleId: 'r1' });
  });

  it('aggregates writes from multiple rules', () => {
    const rules: RuleDefinition[] = [
      { id: 'r1', when: dummyAst, writes: [{ path: 'a', value: { kind: 'literal', value: 1 }, mode: 'set' }] },
      { id: 'r2', when: dummyAst, writes: [{ path: 'b', value: { kind: 'literal', value: 2 }, mode: 'set' }] },
    ];
    const engine = createMockEngine();

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

  it('setValue triggers expression evaluation with engine', () => {
    const engine: ExpressionEngine = {
      id: 'calc-engine',
      evaluate: (node: ExprNode, scope: ExpressionScope) => {
        if (node.kind === 'literal') return node.value;
        if (node.kind === 'path') {
          return scope[node.path];
        }
        return null;
      },
    };

    const rules: RuleDefinition[] = [
      {
        id: 'calc',
        when: { kind: 'literal', value: true },
        writes: [{ path: 'total', value: { kind: 'literal', value: 42 }, mode: 'set' }],
      },
    ];

    const form = createForm({
      initialData: { price: 10, qty: 0, total: 0 },
      expressionEngine: engine,
      rules,
    });

    form.setValue('qty', 5);
    expect((form.getState().data as Record<string, unknown>).total).toBe(42);

    form.dispose();
  });

  it('expression engine writing to $ui path works in dispatch cycle', () => {
    const engine: ExpressionEngine = {
      id: 'vis-engine',
      evaluate: (node: ExprNode, scope: ExpressionScope) => {
        if (node.kind === 'literal') return node.value;
        if (node.kind === 'path') {
          return scope[node.path];
        }
        return null;
      },
    };

    const rules: RuleDefinition[] = [{
      id: 'vis',
      when: { kind: 'literal', value: true },
      writes: [{ path: '$ui.showTotal', value: { kind: 'literal', value: true }, mode: 'set' }],
    }];

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
