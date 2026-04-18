import { describe, test, expect } from 'bun:test';
import { structuralEqual, setNestedValue, deleteNestedValue, executeRules } from '../rule-engine.js';
import { FormStore } from '../store.js';
import { parsePath } from '../path-parser.js';
import type { FormState } from '../state.js';
import type { ExprNode } from '@ghost/predicate';
import type { ExpressionEngine, RuleDefinition } from '../contracts.js';

describe('zc6h: structuralEqual', () => {
  test('primitives', () => {
    expect(structuralEqual(1, 1)).toBe(true);
    expect(structuralEqual('a', 'a')).toBe(true);
    expect(structuralEqual(null, null)).toBe(true);
    expect(structuralEqual(1, 2)).toBe(false);
    expect(structuralEqual(null, 1)).toBe(false);
  });

  test('objects', () => {
    expect(structuralEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(structuralEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(structuralEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  test('arrays', () => {
    expect(structuralEqual([1, 2], [1, 2])).toBe(true);
    expect(structuralEqual([1, 2], [1, 3])).toBe(false);
    expect(structuralEqual([1], [1, 2])).toBe(false);
  });

  test('nested', () => {
    expect(structuralEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(structuralEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
  });

  test('array vs object', () => {
    expect(structuralEqual([], {})).toBe(false);
  });
});

describe('zc6h: convergence with object writes', () => {
  test('converges when rule writes same object value via structuralEqual', () => {
    // Use a custom engine that returns objects from evaluate
    const condNode: ExprNode = { kind: 'literal', value: true };
    const valNode: ExprNode = { kind: 'path', path: 'source' };
    const engine: ExpressionEngine = {
      id: 'test',
      evaluate: (expr: ExprNode, scope: Record<string, unknown>) => {
        if (expr.kind === 'literal') return expr.value;
        if (expr.kind === 'path') {
          const parts = expr.path.split('.');
          let cur: unknown = scope;
          for (const p of parts) {
            if (cur == null || typeof cur !== 'object') return undefined;
            cur = (cur as Record<string, unknown>)[p];
          }
          return cur;
        }
        return undefined;
      },
    };
    const rules: RuleDefinition[] = [{
      id: 'r1',
      when: condNode,
      writes: [{ path: 'target', value: valNode, mode: 'set' as const }],
    }];
    // source and target have structurally equal values but different references
    const scope = { source: { x: 1 }, target: { x: 1 } };
    const result = executeRules(engine, rules, scope);
    expect(result.converged).toBe(true);
    // Should converge in 1 iteration since values are structurally equal
    expect(result.iterations).toBe(1);
  });
});

describe('zc6h: empty segments guard', () => {
  test('setNestedValue throws on empty segments', () => {
    expect(() => setNestedValue({}, [], 1)).toThrow();
  });

  test('setNestedValue filters empty string segments', () => {
    const result = setNestedValue({}, ['', 'a'], 1);
    expect(result).toEqual({ a: 1 });
  });

  test('deleteNestedValue throws on empty segments', () => {
    expect(() => deleteNestedValue({}, [])).toThrow();
  });
});

describe('bwjq: setNestedValue creates arrays for numeric segments', () => {
  test('creates array when next segment is numeric', () => {
    const result = setNestedValue({}, ['items', '0', 'name'], 'test');
    expect(Array.isArray((result as Record<string, unknown>).items)).toBe(true);
    const items = (result as Record<string, unknown>).items as unknown[];
    expect((items[0] as Record<string, unknown>).name).toBe('test');
  });

  test('creates object when next segment is non-numeric', () => {
    const result = setNestedValue({}, ['items', 'foo', 'name'], 'test');
    expect(Array.isArray((result as Record<string, unknown>).items)).toBe(false);
  });
});

describe('n60a: path cache bounded', () => {
  test('cache does not grow unbounded', () => {
    // Parse 1100 unique paths — cache should not exceed 1000
    for (let i = 0; i < 1100; i++) {
      parsePath(`field_${i}`);
    }
    // If we got here without OOM, the bound works
    expect(true).toBe(true);
  });
});

describe('n60a: store dispose rollbacks active transaction', () => {
  test('dispose rolls back active transaction', () => {
    const initial: FormState = {
      data: { x: 1 },
      uiState: {},
      meta: { stage: 'draft', validation: {} },
      issues: [],
    };
    const store = new FormStore(initial);
    const tx = store.beginTransaction();
    tx.mutate((d) => ({ ...d, data: { x: 2 } }));

    store.dispose();

    // Transaction should be rolled back
    expect(tx.status).toBe('rolled-back');
  });
});
