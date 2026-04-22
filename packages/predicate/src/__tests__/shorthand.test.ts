import { describe, expect, it } from 'bun:test';
import { compileShorthand } from '../shorthand.js';
import { evaluate } from '../evaluator.js';
import type { ExprNode } from '../ast.js';

function path(p: string): ExprNode {
  return { kind: 'path', path: p };
}

function lit(value: string | number | boolean | null): ExprNode {
  return { kind: 'literal', value };
}

function op(name: string, ...args: ExprNode[]): ExprNode {
  return { kind: 'op', op: name, args };
}

describe('compileShorthand', () => {
  describe('simple equality', () => {
    it('bare string value becomes $eq', () => {
      const ast = compileShorthand({ name: 'Alice' });
      expect(ast).toEqual(op('$eq', path('name'), lit('Alice')));
    });

    it('bare number value becomes $eq', () => {
      const ast = compileShorthand({ age: 25 });
      expect(ast).toEqual(op('$eq', path('age'), lit(25)));
    });

    it('bare boolean value becomes $eq', () => {
      const ast = compileShorthand({ active: true });
      expect(ast).toEqual(op('$eq', path('active'), lit(true)));
    });

    it('bare null value becomes $eq', () => {
      const ast = compileShorthand({ name: null });
      expect(ast).toEqual(op('$eq', path('name'), lit(null)));
    });
  });

  describe('operator objects', () => {
    it('$gte operator', () => {
      const ast = compileShorthand({ age: { $gte: 18 } });
      expect(ast).toEqual(op('$gte', path('age'), lit(18)));
    });

    it('$lt operator', () => {
      const ast = compileShorthand({ score: { $lt: 100 } });
      expect(ast).toEqual(op('$lt', path('score'), lit(100)));
    });

    it('$ne operator', () => {
      const ast = compileShorthand({ status: { $ne: 'deleted' } });
      expect(ast).toEqual(op('$ne', path('status'), lit('deleted')));
    });
  });

  describe('multi-key implicit $and', () => {
    it('two fields become $and', () => {
      const ast = compileShorthand({ a: 1, b: 2 });
      expect(ast).toEqual(op('$and', op('$eq', path('a'), lit(1)), op('$eq', path('b'), lit(2))));
    });
  });

  describe('dot-notation paths', () => {
    it('nested dot path', () => {
      const ast = compileShorthand({ 'address.city': 'NYC' });
      expect(ast).toEqual(op('$eq', path('address.city'), lit('NYC')));
    });
  });

  describe('top-level logical operators', () => {
    it('$or with array of conditions', () => {
      const ast = compileShorthand({ $or: [{ a: 1 }, { b: 2 }] });
      expect(ast).toEqual(
        op('$or', op('$eq', path('a'), lit(1)), op('$eq', path('b'), lit(2))),
      );
    });

    it('$and with array of conditions', () => {
      const ast = compileShorthand({ $and: [{ a: 1 }, { b: 2 }] });
      expect(ast).toEqual(
        op('$and', op('$eq', path('a'), lit(1)), op('$eq', path('b'), lit(2))),
      );
    });

    it('$not with object condition', () => {
      const ast = compileShorthand({ $not: { active: true } });
      expect(ast).toEqual(op('$not', op('$eq', path('active'), lit(true))));
    });
  });

  describe('$in operator', () => {
    it('compiles $in with array', () => {
      const ast = compileShorthand({ status: { $in: ['active', 'pending'] } });
      expect(ast.kind).toBe('op');
      if (ast.kind === 'op') {
        expect(ast.op).toBe('$in');
        expect(ast.args[0]).toEqual(path('status'));
      }
    });

    it('throws if $in value is not array', () => {
      expect(() => compileShorthand({ status: { $in: 'bad' } })).toThrow('$in requires an array');
    });
  });

  describe('$exists operator', () => {
    it('compiles $exists: true', () => {
      const ast = compileShorthand({ name: { $exists: true } });
      expect(ast).toEqual(op('$exists', path('name'), lit(true)));
    });

    it('compiles $exists: false', () => {
      const ast = compileShorthand({ name: { $exists: false } });
      expect(ast).toEqual(op('$exists', path('name'), lit(false)));
    });
  });

  describe('$regex operator', () => {
    it('compiles $regex', () => {
      const ast = compileShorthand({ email: { $regex: '@example\\.com' } });
      expect(ast).toEqual(op('$regex', path('email'), lit('@example\\.com')));
    });
  });

  describe('multiple operators per field', () => {
    it('$gte and $lt become $and', () => {
      const ast = compileShorthand({ age: { $gte: 18, $lt: 65 } });
      expect(ast).toEqual(
        op('$and', op('$gte', path('age'), lit(18)), op('$lt', path('age'), lit(65))),
      );
    });
  });

  describe('empty query', () => {
    it('returns literal true', () => {
      const ast = compileShorthand({});
      expect(ast).toEqual(lit(true));
    });
  });

  describe('integration with evaluate', () => {
    it('simple equality matches', () => {
      const ast = compileShorthand({ name: 'Alice' });
      expect(evaluate(ast, { name: 'Alice' })).toBe(true);
      expect(evaluate(ast, { name: 'Bob' })).toBe(false);
    });

    it('$gte comparison', () => {
      const ast = compileShorthand({ age: { $gte: 18 } });
      expect(evaluate(ast, { age: 25 })).toBe(true);
      expect(evaluate(ast, { age: 10 })).toBe(false);
    });

    it('multi-key AND', () => {
      const ast = compileShorthand({ age: { $gte: 18 }, active: true });
      expect(evaluate(ast, { age: 25, active: true })).toBe(true);
      expect(evaluate(ast, { age: 25, active: false })).toBe(false);
      expect(evaluate(ast, { age: 10, active: true })).toBe(false);
    });

    it('dot-notation path resolves', () => {
      const ast = compileShorthand({ 'address.city': 'NYC' });
      expect(evaluate(ast, { address: { city: 'NYC' } })).toBe(true);
      expect(evaluate(ast, { address: { city: 'LA' } })).toBe(false);
    });

    it('$or evaluates correctly', () => {
      const ast = compileShorthand({ $or: [{ name: 'Alice' }, { name: 'Bob' }] });
      expect(evaluate(ast, { name: 'Alice' })).toBe(true);
      expect(evaluate(ast, { name: 'Bob' })).toBe(true);
      expect(evaluate(ast, { name: 'Charlie' })).toBe(false);
    });

    it('$not evaluates correctly', () => {
      const ast = compileShorthand({ $not: { active: true } });
      expect(evaluate(ast, { active: false })).toBe(true);
      expect(evaluate(ast, { active: true })).toBe(false);
    });

    it('$exists checks field presence', () => {
      const ast = compileShorthand({ name: { $exists: true } });
      expect(evaluate(ast, { name: 'Alice' })).toBe(true);
      expect(evaluate(ast, {})).toBe(false);
    });

    it('$regex matches pattern', () => {
      const ast = compileShorthand({ email: { $regex: '@example\\.com$' } });
      expect(evaluate(ast, { email: 'alice@example.com' })).toBe(true);
      expect(evaluate(ast, { email: 'alice@other.com' })).toBe(false);
    });

    it('$in matches against array', () => {
      const ast = compileShorthand({ status: { $in: ['active', 'pending'] } });
      expect(evaluate(ast, { status: 'active' })).toBe(true);
      expect(evaluate(ast, { status: 'pending' })).toBe(true);
      expect(evaluate(ast, { status: 'deleted' })).toBe(false);
    });

    it('multi-operator per field', () => {
      const ast = compileShorthand({ age: { $gte: 18, $lt: 65 } });
      expect(evaluate(ast, { age: 30 })).toBe(true);
      expect(evaluate(ast, { age: 10 })).toBe(false);
      expect(evaluate(ast, { age: 70 })).toBe(false);
    });

    it('empty query evaluates to true', () => {
      expect(evaluate(compileShorthand({}), {})).toBe(true);
    });

    it('$elemMatch matches element in array', () => {
      const ast = compileShorthand({ orders: { $elemMatch: { amount: { $gte: 100 } } } });
      expect(evaluate(ast, { orders: [{ amount: 50 }, { amount: 150 }] })).toBe(true);
      expect(evaluate(ast, { orders: [{ amount: 10 }, { amount: 20 }] })).toBe(false);
    });

    it('$elemMatch returns false for non-array', () => {
      const ast = compileShorthand({ orders: { $elemMatch: { amount: { $gte: 100 } } } });
      expect(evaluate(ast, { orders: 'not-an-array' })).toBe(false);
    });

    it('$elemMatch returns false for missing field', () => {
      const ast = compileShorthand({ orders: { $elemMatch: { amount: { $gte: 100 } } } });
      expect(evaluate(ast, {})).toBe(false);
    });

    it('$regex with $options flags', () => {
      const ast = compileShorthand({ name: { $regex: '^alice', $options: 'i' } });
      expect(evaluate(ast, { name: 'Alice' })).toBe(true);
      expect(evaluate(ast, { name: 'ALICE' })).toBe(true);
      expect(evaluate(ast, { name: 'Bob' })).toBe(false);
    });

    it('RegExp literal compiles to $regex', () => {
      const ast = compileShorthand({ name: /^Alice/i });
      expect(evaluate(ast, { name: 'Alice' })).toBe(true);
      expect(evaluate(ast, { name: 'alice' })).toBe(true);
      expect(evaluate(ast, { name: 'Bob' })).toBe(false);
    });

    it('RegExp literal without flags', () => {
      const ast = compileShorthand({ name: /^Alice/ });
      expect(evaluate(ast, { name: 'Alice' })).toBe(true);
      expect(evaluate(ast, { name: 'alice' })).toBe(false);
    });

    it('$regex cache returns consistent results', () => {
      const ast = compileShorthand({ email: { $regex: '@test\\.com$' } });
      expect(evaluate(ast, { email: 'a@test.com' })).toBe(true);
      expect(evaluate(ast, { email: 'b@test.com' })).toBe(true);
      expect(evaluate(ast, { email: 'a@other.com' })).toBe(false);
    });
  });

  describe('$elemMatch compilation', () => {
    it('compiles $elemMatch with sub-query', () => {
      const ast = compileShorthand({ items: { $elemMatch: { qty: { $gte: 5 } } } });
      expect(ast.kind).toBe('op');
      if (ast.kind === 'op') {
        expect(ast.op).toBe('$elemMatch');
        expect(ast.args[0]).toEqual(path('items'));
      }
    });

    it('throws if $elemMatch value is not object', () => {
      expect(() => compileShorthand({ items: { $elemMatch: 'bad' } })).toThrow('$elemMatch requires an object sub-query');
    });

    it('throws if $elemMatch value is array', () => {
      expect(() => compileShorthand({ items: { $elemMatch: [1, 2] } })).toThrow('$elemMatch requires an object sub-query');
    });
  });

  describe('$regex with $options compilation', () => {
    it('compiles $regex + $options as 3-arg node', () => {
      const ast = compileShorthand({ name: { $regex: '^test', $options: 'i' } });
      expect(ast.kind).toBe('op');
      if (ast.kind === 'op') {
        expect(ast.op).toBe('$regex');
        expect(ast.args).toHaveLength(3);
        expect(ast.args[2]).toEqual(lit('i'));
      }
    });

    it('compiles $regex without $options as 2-arg node', () => {
      const ast = compileShorthand({ name: { $regex: '^test' } });
      expect(ast.kind).toBe('op');
      if (ast.kind === 'op') {
        expect(ast.op).toBe('$regex');
        expect(ast.args).toHaveLength(2);
      }
    });
  });

  describe('RegExp literal compilation', () => {
    it('compiles RegExp with flags to 3-arg $regex', () => {
      const ast = compileShorthand({ name: /^test/gi });
      expect(ast.kind).toBe('op');
      if (ast.kind === 'op') {
        expect(ast.op).toBe('$regex');
        expect(ast.args).toHaveLength(3);
        expect(ast.args[1]).toEqual(lit('^test'));
        expect(ast.args[2]).toEqual(lit('gi'));
      }
    });

    it('compiles RegExp without flags to 2-arg $regex', () => {
      const ast = compileShorthand({ name: /^test/ });
      expect(ast.kind).toBe('op');
      if (ast.kind === 'op') {
        expect(ast.op).toBe('$regex');
        expect(ast.args).toHaveLength(2);
      }
    });
  });
});
