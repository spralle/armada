import { describe, it, expect } from 'bun:test';
import type { ExprNode } from '../ast.js';
import type { RuleDefinition } from '../ast.js';
import { evaluate, type EvaluationScope } from '../evaluator.js';
import { compile } from '../compiler.js';
import { executeRules } from '../rule-engine.js';
import { PredicateError } from '../errors.js';

/**
 * F3: Expressions/rules conformance fixtures.
 * Verifies: AST execution correct, operator typing enforced,
 * no coercion, write conflicts detected, non-convergence guard,
 * deterministic traces.
 */

function scope(data: unknown = {}, uiState: unknown = {}, meta: unknown = {}): EvaluationScope {
  return { data, uiState, meta };
}

function lit(value: string | number | boolean | null): ExprNode {
  return { kind: 'literal', value };
}

function path(p: string): ExprNode {
  return { kind: 'path', path: p };
}

function op(name: string, ...args: ExprNode[]): ExprNode {
  return { kind: 'op', op: name, args };
}

describe('F3: AST execution correctness', () => {
  it('literal evaluation is identity', () => {
    expect(evaluate(lit(42), scope())).toBe(42);
    expect(evaluate(lit('hello'), scope())).toBe('hello');
    expect(evaluate(lit(true), scope())).toBe(true);
    expect(evaluate(lit(null), scope())).toBe(null);
  });

  it('path resolution traverses nested data', () => {
    const s = scope({ a: { b: { c: 99 } } });
    expect(evaluate(path('a.b.c'), s)).toBe(99);
  });

  it('path resolution for $ui namespace', () => {
    const s = scope({}, { visible: true, nested: { x: 1 } });
    expect(evaluate(path('$ui.visible'), s)).toBe(true);
    expect(evaluate(path('$ui.nested.x'), s)).toBe(1);
  });

  it('path resolution for $meta namespace', () => {
    const s = scope({}, {}, { stage: 'draft' });
    expect(evaluate(path('$meta.stage'), s)).toBe('draft');
  });

  it('missing path returns undefined without throwing', () => {
    expect(evaluate(path('nonexistent'), scope())).toBeUndefined();
    expect(evaluate(path('a.b.c'), scope())).toBeUndefined();
  });

  it('$eq with same types', () => {
    expect(evaluate(op('$eq', lit(1), lit(1)), scope())).toBe(true);
    expect(evaluate(op('$eq', lit('a'), lit('a')), scope())).toBe(true);
    expect(evaluate(op('$eq', lit(1), lit(2)), scope())).toBe(false);
  });

  it('$and / $or / $not logical operators', () => {
    expect(evaluate(op('$and', lit(true), lit(true)), scope())).toBe(true);
    expect(evaluate(op('$and', lit(true), lit(false)), scope())).toBe(false);
    expect(evaluate(op('$or', lit(false), lit(true)), scope())).toBe(true);
    expect(evaluate(op('$not', lit(false)), scope())).toBe(true);
  });

  it('$in / $nin with array data', () => {
    const s = scope({ list: [1, 2, 3] });
    expect(evaluate(op('$in', lit(2), path('list')), s)).toBe(true);
    expect(evaluate(op('$nin', lit(5), path('list')), s)).toBe(true);
  });

  it('$exists checks path presence', () => {
    const s = scope({ name: 'Alice' });
    expect(evaluate(op('$exists', path('name'), lit(true)), s)).toBe(true);
    expect(evaluate(op('$exists', path('missing'), lit(true)), s)).toBe(false);
    expect(evaluate(op('$exists', path('missing'), lit(false)), s)).toBe(true);
  });
});

describe('F3: Operator typing enforced — no coercion', () => {
  it('$eq(42, "42") → false (strict equality, no coercion)', () => {
    expect(evaluate(op('$eq', lit(42), lit('42')), scope())).toBe(false);
  });

  it('$gt with mixed types throws FORMR_EXPR_TYPE_MISMATCH', () => {
    expect(() => evaluate(op('$gt', lit(10), lit('5')), scope())).toThrow(PredicateError);
    try {
      evaluate(op('$gt', lit(10), lit('5')), scope());
    } catch (e) {
      expect((e as PredicateError).code).toBe('FORMR_EXPR_TYPE_MISMATCH');
    }
  });

  it('$lt with mixed types throws FORMR_EXPR_TYPE_MISMATCH', () => {
    expect(() => evaluate(op('$lt', lit('a'), lit(1)), scope())).toThrow(PredicateError);
  });

  it('$gte with mixed types throws FORMR_EXPR_TYPE_MISMATCH', () => {
    expect(() => evaluate(op('$gte', lit(true), lit(1)), scope())).toThrow(PredicateError);
  });

  it('$in with non-array second arg throws FORMR_EXPR_TYPE_MISMATCH', () => {
    expect(() => evaluate(op('$in', lit(1), lit('not-array')), scope())).toThrow(PredicateError);
  });

  it('unknown operator throws', () => {
    expect(() => evaluate(op('$unknown', lit(1)), scope())).toThrow(PredicateError);
  });
});

describe('F3: Compiler correctness', () => {
  it('compiles $eq operator', () => {
    const ast = compile({ $eq: [{ $path: 'x' }, 42] });
    expect(ast.kind).toBe('op');
    if (ast.kind === 'op') {
      expect(ast.op).toBe('$eq');
      expect(ast.args).toHaveLength(2);
    }
  });

  it('rejects unsupported literal types', () => {
    expect(() => compile(undefined)).toThrow(PredicateError);
    expect(() => compile(Symbol('x'))).toThrow(PredicateError);
  });

  it('rejects arrays as root', () => {
    expect(() => compile([1, 2])).toThrow(PredicateError);
  });

  it('rejects unknown operators', () => {
    expect(() => compile({ $bogus: [1] })).toThrow(PredicateError);
  });

  it('rejects empty objects', () => {
    expect(() => compile({})).toThrow(PredicateError);
  });
});

describe('F3: Write conflicts detected', () => {
  it('two rules writing different values to same path → FORMR_RULE_WRITE_CONFLICT', () => {
    const rules: RuleDefinition[] = [
      { id: 'r1', when: lit(true), writes: [{ path: 'x', value: lit(1), mode: 'set' }] },
      { id: 'r2', when: lit(true), writes: [{ path: 'x', value: lit(2), mode: 'set' }] },
    ];
    try {
      executeRules(rules, scope());
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(PredicateError);
      expect((e as PredicateError).code).toBe('FORMR_RULE_WRITE_CONFLICT');
    }
  });

  it('same value to same path is NOT a conflict', () => {
    const rules: RuleDefinition[] = [
      { id: 'r1', when: lit(true), writes: [{ path: 'x', value: lit(5), mode: 'set' }] },
      { id: 'r2', when: lit(true), writes: [{ path: 'x', value: lit(5), mode: 'set' }] },
    ];
    const result = executeRules(rules, scope());
    expect(result.converged).toBe(true);
  });
});

describe('F3: Non-convergence guard', () => {
  it('oscillating rules throw FORMR_RULE_NON_CONVERGENT', () => {
    const rules: RuleDefinition[] = [
      {
        id: 'r1',
        when: op('$eq', path('x'), lit(1)),
        writes: [{ path: 'x', value: lit(2), mode: 'set' }],
      },
      {
        id: 'r2',
        when: op('$eq', path('x'), lit(2)),
        writes: [{ path: 'x', value: lit(1), mode: 'set' }],
      },
    ];
    try {
      executeRules(rules, scope({ x: 1 }), { maxIterations: 4 });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(PredicateError);
      expect((e as PredicateError).code).toBe('FORMR_RULE_NON_CONVERGENT');
    }
  });

  it('convergent cascading rules complete within iteration budget', () => {
    const rules: RuleDefinition[] = [
      {
        id: 'r1',
        when: op('$eq', path('a'), lit(null)),
        writes: [{ path: 'a', value: lit(1), mode: 'set' }],
      },
      {
        id: 'r2',
        when: op('$and', op('$eq', path('a'), lit(1)), op('$eq', path('b'), lit(null))),
        writes: [{ path: 'b', value: lit(2), mode: 'set' }],
      },
    ];
    const result = executeRules(rules, scope({ a: null, b: null }));
    expect(result.converged).toBe(true);
    expect(result.writes).toHaveLength(2);
  });
});

describe('F3: Deterministic traces', () => {
  it('same rules + same scope produce identical write sequences', () => {
    const rules: RuleDefinition[] = [
      { id: 'r1', when: lit(true), writes: [{ path: 'a', value: lit(1), mode: 'set' }] },
      { id: 'r2', when: lit(true), writes: [{ path: 'b', value: lit(2), mode: 'set' }] },
    ];
    const s = scope();
    const result1 = executeRules(rules, s);
    const result2 = executeRules(rules, s);
    const result3 = executeRules(rules, s);

    const writeKey = (w: any) => `${w.ruleId}:${w.path}:${w.value}:${w.mode}`;
    expect(result1.writes.map(writeKey)).toEqual(result2.writes.map(writeKey));
    expect(result2.writes.map(writeKey)).toEqual(result3.writes.map(writeKey));
    expect(result1.iterations).toBe(result2.iterations);
  });

  it('disallowed write target throws FORMR_RULE_DISALLOWED_TARGET', () => {
    const rules: RuleDefinition[] = [{
      id: 'r1',
      when: lit(true),
      writes: [{ path: 'data.x', value: lit(1), mode: 'set' }],
    }];
    try {
      executeRules(rules, scope(), { allowedWriteTargets: ['$ui.'] });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(PredicateError);
      expect((e as PredicateError).code).toBe('FORMR_RULE_DISALLOWED_TARGET');
    }
  });
});
