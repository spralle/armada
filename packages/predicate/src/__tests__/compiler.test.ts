import { describe, expect, it } from 'bun:test';
import { compile } from '../compiler.js';
import { PredicateError } from '../errors.js';

describe('compile', () => {
  describe('literals', () => {
    it('compiles a string literal', () => {
      expect(compile('hello')).toEqual({ kind: 'literal', value: 'hello' });
    });

    it('compiles a number literal', () => {
      expect(compile(42)).toEqual({ kind: 'literal', value: 42 });
    });

    it('compiles a boolean literal', () => {
      expect(compile(true)).toEqual({ kind: 'literal', value: true });
    });

    it('compiles a null literal', () => {
      expect(compile(null)).toEqual({ kind: 'literal', value: null });
    });
  });

  describe('path references', () => {
    it('compiles a path reference', () => {
      expect(compile({ $path: 'customer.email' })).toEqual({
        kind: 'path',
        path: 'customer.email',
      });
    });
  });

  describe('operators', () => {
    it('compiles a simple $eq operation', () => {
      const result = compile({ $eq: [{ $path: 'status' }, 'active'] });
      expect(result).toEqual({
        kind: 'op',
        op: '$eq',
        args: [
          { kind: 'path', path: 'status' },
          { kind: 'literal', value: 'active' },
        ],
      });
    });

    it('compiles nested operations', () => {
      const result = compile({
        $and: [
          { $eq: [{ $path: 'age' }, 18] },
          { $gt: [{ $path: 'score' }, 50] },
        ],
      });
      expect(result).toEqual({
        kind: 'op',
        op: '$and',
        args: [
          {
            kind: 'op',
            op: '$eq',
            args: [
              { kind: 'path', path: 'age' },
              { kind: 'literal', value: 18 },
            ],
          },
          {
            kind: 'op',
            op: '$gt',
            args: [
              { kind: 'path', path: 'score' },
              { kind: 'literal', value: 50 },
            ],
          },
        ],
      });
    });

    it('compiles a unary $not operation', () => {
      const result = compile({ $not: [{ $eq: [{ $path: 'active' }, true] }] });
      expect(result).toEqual({
        kind: 'op',
        op: '$not',
        args: [
          {
            kind: 'op',
            op: '$eq',
            args: [
              { kind: 'path', path: 'active' },
              { kind: 'literal', value: true },
            ],
          },
        ],
      });
    });
  });

  describe('errors', () => {
    it('rejects undefined', () => {
      expect(() => compile(undefined)).toThrow(PredicateError);
      try { compile(undefined); } catch (e) {
        expect((e as PredicateError).code).toBe('FORMR_EXPR_COMPILE_UNSUPPORTED_LITERAL');
      }
    });

    it('rejects Symbol', () => {
      expect(() => compile(Symbol())).toThrow(PredicateError);
      try { compile(Symbol()); } catch (e) {
        expect((e as PredicateError).code).toBe('FORMR_EXPR_COMPILE_UNSUPPORTED_LITERAL');
      }
    });

    it('rejects arrays at root', () => {
      expect(() => compile([1, 2, 3])).toThrow(PredicateError);
      try { compile([1, 2, 3]); } catch (e) {
        expect((e as PredicateError).code).toBe('FORMR_EXPR_PARSE_INVALID_ROOT');
      }
    });

    it('rejects unknown operators', () => {
      expect(() => compile({ $unknown: [1] })).toThrow(PredicateError);
      try { compile({ $unknown: [1] }); } catch (e) {
        expect((e as PredicateError).code).toBe('FORMR_EXPR_PARSE_UNKNOWN_OPERATOR');
      }
    });

    it('rejects wrong arity', () => {
      expect(() => compile({ $eq: [1] })).toThrow(PredicateError);
      try { compile({ $eq: [1] }); } catch (e) {
        expect((e as PredicateError).code).toBe('FORMR_EXPR_PARSE_INVALID_ARGUMENTS');
      }
    });

    it('rejects non-string $path', () => {
      expect(() => compile({ $path: 123 })).toThrow(PredicateError);
      try { compile({ $path: 123 }); } catch (e) {
        expect((e as PredicateError).code).toBe('FORMR_EXPR_PARSE_INVALID_PATH');
      }
    });

    it('rejects ambiguous objects with multiple operators', () => {
      expect(() => compile({ $eq: [1, 2], $gt: [3, 4] })).toThrow(PredicateError);
      try { compile({ $eq: [1, 2], $gt: [3, 4] }); } catch (e) {
        expect((e as PredicateError).code).toBe('FORMR_EXPR_COMPILE_AMBIGUOUS_OBJECT');
      }
    });
  });

  describe('determinism', () => {
    it('produces identical AST for identical input', () => {
      const input = { $and: [{ $eq: [{ $path: 'a' }, 1] }, { $gt: [{ $path: 'b' }, 2] }] };
      const first = compile(input);
      const second = compile(input);
      expect(first).toEqual(second);
    });
  });
});
