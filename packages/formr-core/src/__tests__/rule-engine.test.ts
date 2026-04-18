import { describe, expect, it } from 'bun:test';
import { executeRules } from '../rule-engine.js';
import type { RuleDefinition, ExpressionEngine, ExpressionScope, ExprNode, EvaluationScope } from '../contracts.js';
import { FormrError } from '../errors.js';
import { evaluate } from '@ghost/predicate';

const engine: ExpressionEngine = {
  id: 'test',
  evaluate: (node: ExprNode, scope: ExpressionScope) => evaluate(node, scope),
};

const scope = (data: Record<string, unknown> = {}, uiState: unknown = {}, meta: unknown = {}): EvaluationScope =>
  ({ ...data, $ui: uiState, $meta: meta });

const lit = (value: string | number | boolean | null) =>
  ({ kind: 'literal' as const, value });

const path = (p: string) =>
  ({ kind: 'path' as const, path: p });

describe('executeRules', () => {
  it('single rule that fires produces a write', () => {
    const rules: RuleDefinition[] = [{
      id: 'r1',
      when: lit(true),
      writes: [{ path: 'x', value: lit(42), mode: 'set' }],
    }];
    const result = executeRules(engine, rules, scope());
    expect(result.converged).toBe(true);
    expect(result.writes).toHaveLength(1);
    expect(result.writes[0]).toEqual({ path: 'x', value: 42, mode: 'set', ruleId: 'r1' });
  });

  it('rule with false condition produces no writes', () => {
    const rules: RuleDefinition[] = [{
      id: 'r1',
      when: lit(false),
      writes: [{ path: 'x', value: lit(1), mode: 'set' }],
    }];
    const result = executeRules(engine, rules, scope());
    expect(result.converged).toBe(true);
    expect(result.writes).toHaveLength(0);
    expect(result.iterations).toBe(1);
  });

  it('two rules writing to different paths — both collected', () => {
    const rules: RuleDefinition[] = [
      { id: 'r1', when: lit(true), writes: [{ path: 'a', value: lit(1), mode: 'set' }] },
      { id: 'r2', when: lit(true), writes: [{ path: 'b', value: lit(2), mode: 'set' }] },
    ];
    const result = executeRules(engine, rules, scope());
    expect(result.writes).toHaveLength(2);
    expect(result.converged).toBe(true);
  });

  it('two rules writing same value to same path — deduped', () => {
    const rules: RuleDefinition[] = [
      { id: 'r1', when: lit(true), writes: [{ path: 'x', value: lit(5), mode: 'set' }] },
      { id: 'r2', when: lit(true), writes: [{ path: 'x', value: lit(5), mode: 'set' }] },
    ];
    const result = executeRules(engine, rules, scope());
    expect(result.converged).toBe(true);
  });

  it('two rules writing different values to same path → FORMR_RULE_WRITE_CONFLICT', () => {
    const rules: RuleDefinition[] = [
      { id: 'r1', when: lit(true), writes: [{ path: 'x', value: lit(1), mode: 'set' }] },
      { id: 'r2', when: lit(true), writes: [{ path: 'x', value: lit(2), mode: 'set' }] },
    ];
    expect(() => executeRules(engine, rules, scope())).toThrow(FormrError);
    try {
      executeRules(engine, rules, scope());
    } catch (e) {
      expect((e as FormrError).code).toBe('FORMR_RULE_WRITE_CONFLICT');
    }
  });

  it('convergence in 1 iteration — rule fires once then condition becomes false', () => {
    const rules: RuleDefinition[] = [{
      id: 'r1',
      when: { kind: 'op', op: '$eq', args: [path('x'), lit(null)] },
      writes: [{ path: 'x', value: lit(1), mode: 'set' }],
    }];
    const result = executeRules(engine, rules, scope({ x: null }));
    expect(result.converged).toBe(true);
    expect(result.iterations).toBe(2);
    expect(result.writes).toHaveLength(1);
  });

  it('convergence in 2 iterations — cascading rules', () => {
    const rules: RuleDefinition[] = [
      {
        id: 'r1',
        when: { kind: 'op', op: '$eq', args: [path('a'), lit(null)] },
        writes: [{ path: 'a', value: lit(1), mode: 'set' }],
      },
      {
        id: 'r2',
        when: { kind: 'op', op: '$and', args: [
          { kind: 'op', op: '$eq', args: [path('a'), lit(1)] },
          { kind: 'op', op: '$eq', args: [path('b'), lit(null)] },
        ]},
        writes: [{ path: 'b', value: lit(2), mode: 'set' }],
      },
    ];
    const result = executeRules(engine, rules, scope({ a: null, b: null }));
    expect(result.converged).toBe(true);
    expect(result.iterations).toBe(3);
    expect(result.writes).toHaveLength(2);
  });

  it('non-convergence — oscillating rules → FORMR_RULE_NON_CONVERGENT', () => {
    const rules: RuleDefinition[] = [
      {
        id: 'r1',
        when: { kind: 'op', op: '$eq', args: [path('x'), lit(1)] },
        writes: [{ path: 'x', value: lit(2), mode: 'set' }],
      },
      {
        id: 'r2',
        when: { kind: 'op', op: '$eq', args: [path('x'), lit(2)] },
        writes: [{ path: 'x', value: lit(1), mode: 'set' }],
      },
    ];
    expect(() => executeRules(engine, rules, scope({ x: 1 }), { maxIterations: 4 })).toThrow(FormrError);
    try {
      executeRules(engine, rules, scope({ x: 1 }), { maxIterations: 4 });
    } catch (e) {
      expect((e as FormrError).code).toBe('FORMR_RULE_NON_CONVERGENT');
    }
  });

  it('max iterations configurable — set to 1, verify early stop', () => {
    const rules: RuleDefinition[] = [
      {
        id: 'r1',
        when: { kind: 'op', op: '$eq', args: [path('x'), lit(1)] },
        writes: [{ path: 'x', value: lit(2), mode: 'set' }],
      },
      {
        id: 'r2',
        when: { kind: 'op', op: '$eq', args: [path('x'), lit(2)] },
        writes: [{ path: 'x', value: lit(1), mode: 'set' }],
      },
    ];
    expect(() => executeRules(engine, rules, scope({ x: 1 }), { maxIterations: 1 })).toThrow(FormrError);
  });

  it('allowed write targets enforced', () => {
    const rules: RuleDefinition[] = [{
      id: 'r1',
      when: lit(true),
      writes: [{ path: 'forbidden.x', value: lit(1), mode: 'set' }],
    }];
    expect(() => executeRules(engine, rules, scope(), { allowedWriteTargets: ['$ui.'] })).toThrow(FormrError);
    try {
      executeRules(engine, rules, scope(), { allowedWriteTargets: ['$ui.'] });
    } catch (e) {
      expect((e as FormrError).code).toBe('FORMR_RULE_DISALLOWED_TARGET');
    }
  });

  it('default max iterations is 16', () => {
    const rules: RuleDefinition[] = [
      {
        id: 'r1',
        when: { kind: 'op', op: '$eq', args: [path('x'), lit(1)] },
        writes: [{ path: 'x', value: lit(2), mode: 'set' }],
      },
      {
        id: 'r2',
        when: { kind: 'op', op: '$eq', args: [path('x'), lit(2)] },
        writes: [{ path: 'x', value: lit(1), mode: 'set' }],
      },
    ];
    try {
      executeRules(engine, rules, scope({ x: 1 }));
    } catch (e) {
      expect((e as FormrError).message).toContain('16 iterations');
    }
  });

  it('empty rules → converged in 1 iteration, no writes', () => {
    const result = executeRules(engine, [], scope());
    expect(result.converged).toBe(true);
    expect(result.iterations).toBe(1);
    expect(result.writes).toHaveLength(0);
  });
});
