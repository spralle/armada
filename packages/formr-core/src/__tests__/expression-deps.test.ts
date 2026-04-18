import { describe, test, expect } from 'bun:test';
import { buildDependencyGraph, getAffectedRules } from '../expression-deps.js';
import type { RuleDefinition } from '../contracts.js';
import type { ExprNode } from '@ghost/predicate';

function path(p: string): ExprNode {
  return { kind: 'path', path: p };
}

function lit(v: string | number | boolean | null): ExprNode {
  return { kind: 'literal', value: v };
}

function op(name: string, ...args: ExprNode[]): ExprNode {
  return { kind: 'op', op: name, args };
}

const ruleA: RuleDefinition = {
  id: 'show-address',
  when: op('$eq', path('country'), lit('US')),
  writes: [{ path: '$ui.address.visible', value: lit(true), mode: 'set' }],
};

const ruleB: RuleDefinition = {
  id: 'calc-total',
  when: op('$gt', path('quantity'), lit(0)),
  writes: [{ path: 'total', value: op('$gt', path('price'), lit(0)), mode: 'set' }],
};

const ruleC: RuleDefinition = {
  id: 'unrelated',
  when: op('$eq', path('status'), lit('active')),
  writes: [{ path: '$ui.banner.visible', value: lit(true), mode: 'set' }],
};

describe('buildDependencyGraph', () => {
  test('extracts read paths from condition and write values', () => {
    const graph = buildDependencyGraph([ruleA, ruleB]);

    expect(graph.rules).toHaveLength(2);

    const depA = graph.rules[0];
    expect(depA.reads).toEqual(['country']);
    expect(depA.writes).toEqual(['$ui.address.visible']);

    const depB = graph.rules[1];
    expect(depB.reads).toContain('quantity');
    expect(depB.reads).toContain('price');
    expect(depB.writes).toEqual(['total']);
  });

  test('handles empty rules', () => {
    const graph = buildDependencyGraph([]);
    expect(graph.rules).toEqual([]);
  });

  test('deduplicates read paths', () => {
    const rule: RuleDefinition = {
      id: 'dup',
      when: op('$and', op('$eq', path('x'), lit(1)), op('$gt', path('x'), lit(0))),
      writes: [{ path: 'y', value: path('x'), mode: 'set' }],
    };
    const graph = buildDependencyGraph([rule]);
    const xCount = graph.rules[0].reads.filter((r) => r === 'x').length;
    expect(xCount).toBe(1);
  });
});

describe('getAffectedRules', () => {
  test('returns only rules reading from changed paths', () => {
    const graph = buildDependencyGraph([ruleA, ruleB, ruleC]);
    const affected = getAffectedRules(graph, ['country']);
    expect(affected).toHaveLength(1);
    expect(affected[0].id).toBe('show-address');
  });

  test('returns multiple affected rules', () => {
    const graph = buildDependencyGraph([ruleA, ruleB, ruleC]);
    const affected = getAffectedRules(graph, ['country', 'quantity']);
    expect(affected).toHaveLength(2);
    expect(affected.map((r) => r.id)).toEqual(['show-address', 'calc-total']);
  });

  test('returns empty when no paths match', () => {
    const graph = buildDependencyGraph([ruleA, ruleB]);
    const affected = getAffectedRules(graph, ['unrelated']);
    expect(affected).toHaveLength(0);
  });

  test('matches parent path changes to child reads', () => {
    const rule: RuleDefinition = {
      id: 'nested',
      when: op('$eq', path('address.city'), lit('NYC')),
      writes: [{ path: 'flag', value: lit(true), mode: 'set' }],
    };
    const graph = buildDependencyGraph([rule]);
    const affected = getAffectedRules(graph, ['address']);
    expect(affected).toHaveLength(1);
    expect(affected[0].id).toBe('nested');
  });
});
