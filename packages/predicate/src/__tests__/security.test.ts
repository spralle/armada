import { describe, expect, it } from 'bun:test';
import { assertSafeSegment } from '../safe-path.js';
import { evaluate, type EvaluationScope } from '../evaluator.js';
import { compile } from '../compiler.js';
import type { ExprNode } from '../ast.js';
import { PredicateError } from '../errors.js';

function makeScope(data: unknown = {}, uiState: unknown = {}, meta: unknown = {}): EvaluationScope {
  return { data, uiState, meta };
}

function path(p: string): ExprNode {
  return { kind: 'path', path: p };
}

function op(name: string, ...args: ExprNode[]): ExprNode {
  return { kind: 'op', op: name, args };
}

function lit(value: string | number | boolean | null): ExprNode {
  return { kind: 'literal', value };
}

describe('prototype pollution prevention', () => {
  describe('assertSafeSegment', () => {
    it('rejects __proto__', () => {
      expect(() => assertSafeSegment('__proto__')).toThrow(PredicateError);
    });

    it('rejects constructor', () => {
      expect(() => assertSafeSegment('constructor')).toThrow(PredicateError);
    });

    it('rejects prototype', () => {
      expect(() => assertSafeSegment('prototype')).toThrow(PredicateError);
    });

    it('allows normal segments', () => {
      expect(() => assertSafeSegment('name')).not.toThrow();
      expect(() => assertSafeSegment('foo')).not.toThrow();
    });
  });

  describe('evaluate path resolution', () => {
    it('rejects __proto__ in path', () => {
      const scope = makeScope({ safe: 'ok' });
      expect(() => evaluate(path('__proto__.polluted'), scope)).toThrow('prototype pollution');
    });

    it('rejects constructor.prototype path', () => {
      const scope = makeScope({});
      expect(() => evaluate(path('constructor.prototype'), scope)).toThrow('prototype pollution');
    });

    it('resolves normal paths after hardening', () => {
      const scope = makeScope({ user: { name: 'Alice' } });
      expect(evaluate(path('user.name'), scope)).toBe('Alice');
    });
  });

  describe('compile path validation', () => {
    it('rejects __proto__ in $path', () => {
      expect(() => compile({ $path: '__proto__.polluted' })).toThrow('prototype pollution');
    });

    it('rejects constructor in $path', () => {
      expect(() => compile({ $path: 'constructor.prototype' })).toThrow('prototype pollution');
    });

    it('compiles normal paths', () => {
      const node = compile({ $path: 'user.name' });
      expect(node).toEqual({ kind: 'path', path: 'user.name' });
    });
  });
});

describe('recursion depth guard', () => {
  function buildDeepAst(depth: number): ExprNode {
    let node: ExprNode = lit(true);
    for (let i = 0; i < depth; i++) {
      node = op('$not', node);
    }
    return node;
  }

  it('evaluates within default depth limit', () => {
    const node = buildDeepAst(100);
    const scope = makeScope();
    expect(() => evaluate(node, scope)).not.toThrow();
  });

  it('throws when exceeding depth limit', () => {
    const node = buildDeepAst(300);
    const scope = makeScope();
    expect(() => evaluate(node, scope)).toThrow('exceeded maximum depth');
  });

  it('respects custom maxDepth', () => {
    const node = buildDeepAst(10);
    const scope = makeScope();
    expect(() => evaluate(node, scope, { maxDepth: 5 })).toThrow('exceeded maximum depth');
  });

  it('compiles within default depth limit', () => {
    const input = buildNestedCompileInput(100);
    expect(() => compile(input)).not.toThrow();
  });

  it('compile throws when exceeding depth limit', () => {
    const input = buildNestedCompileInput(300);
    expect(() => compile(input)).toThrow('exceeded maximum depth');
    });

  it('compile respects custom maxDepth', () => {
    const input = buildNestedCompileInput(10);
    expect(() => compile(input, { maxDepth: 5 })).toThrow('exceeded maximum depth');
  });
});

function buildNestedCompileInput(depth: number): unknown {
  let node: unknown = true;
  for (let i = 0; i < depth; i++) {
    node = { $not: [node] };
  }
  return node;
}
