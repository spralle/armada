import type { ExprNode } from './ast.js';
import { PredicateError } from './errors.js';

export interface EvaluationScope {
  readonly data: unknown;
  readonly uiState: unknown;
  readonly meta: unknown;
}

const MISSING = Symbol('MISSING');

function resolvePath(path: string, scope: EvaluationScope): unknown {
  let root: unknown;
  let segments: string[];

  if (path.startsWith('$ui.')) {
    root = scope.uiState;
    segments = path.slice(4).split('.');
  } else if (path.startsWith('$meta.')) {
    root = scope.meta;
    segments = path.slice(6).split('.');
  } else {
    root = scope.data;
    segments = path.split('.');
  }

  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function resolveArg(node: ExprNode, scope: EvaluationScope): unknown | typeof MISSING {
  if (node.kind === 'path') {
    const result = resolvePath(node.path, scope);
    return result === undefined ? MISSING : result;
  }
  return evaluate(node, scope);
}

function assertComparableTypes(a: unknown, b: unknown, op: string): void {
  const ta = typeof a;
  const tb = typeof b;
  if (ta !== tb || (ta !== 'number' && ta !== 'string')) {
    throw new PredicateError(
      'FORMR_EXPR_TYPE_MISMATCH',
      `${op} requires operands of the same type (number or string), got ${ta} and ${tb}`,
    );
  }
}

function executeOperator(op: string, args: readonly ExprNode[], scope: EvaluationScope): unknown {
  switch (op) {
    case '$eq': {
      const a = resolveArg(args[0], scope);
      const b = resolveArg(args[1], scope);
      // MISSING (undefined path) vs null must be false
      if (a === MISSING && b === MISSING) return true;
      if (a === MISSING) return b === undefined;
      if (b === MISSING) return a === undefined;
      return a === b;
    }
    case '$ne': {
      const a = resolveArg(args[0], scope);
      const b = resolveArg(args[1], scope);
      if (a === MISSING && b === MISSING) return false;
      if (a === MISSING) return b !== undefined;
      if (b === MISSING) return a !== undefined;
      return a !== b;
    }
    case '$gt': {
      const a = evaluate(args[0], scope);
      const b = evaluate(args[1], scope);
      assertComparableTypes(a, b, '$gt');
      return (a as number | string) > (b as number | string);
    }
    case '$gte': {
      const a = evaluate(args[0], scope);
      const b = evaluate(args[1], scope);
      assertComparableTypes(a, b, '$gte');
      return (a as number | string) >= (b as number | string);
    }
    case '$lt': {
      const a = evaluate(args[0], scope);
      const b = evaluate(args[1], scope);
      assertComparableTypes(a, b, '$lt');
      return (a as number | string) < (b as number | string);
    }
    case '$lte': {
      const a = evaluate(args[0], scope);
      const b = evaluate(args[1], scope);
      assertComparableTypes(a, b, '$lte');
      return (a as number | string) <= (b as number | string);
    }
    case '$and':
      return args.every((arg) => Boolean(evaluate(arg, scope)));
    case '$or':
      return args.some((arg) => Boolean(evaluate(arg, scope)));
    case '$not':
      return !evaluate(args[0], scope);
    case '$in': {
      const value = evaluate(args[0], scope);
      const list = evaluate(args[1], scope);
      if (!Array.isArray(list)) {
        throw new PredicateError(
          'FORMR_EXPR_TYPE_MISMATCH',
          '$in requires second argument to be an array',
        );
      }
      return list.includes(value);
    }
    case '$nin': {
      const value = evaluate(args[0], scope);
      const list = evaluate(args[1], scope);
      if (!Array.isArray(list)) {
        throw new PredicateError(
          'FORMR_EXPR_TYPE_MISMATCH',
          '$nin requires second argument to be an array',
        );
      }
      return !list.includes(value);
    }
    case '$exists': {
      const resolved = resolveArg(args[0], scope);
      const expected = evaluate(args[1], scope);
      const exists = resolved !== MISSING;
      return expected ? exists : !exists;
    }
    default:
      throw new PredicateError(
        'FORMR_EXPR_TYPE_MISMATCH',
        `Unknown operator: ${op}`,
      );
  }
}

export function evaluate(node: ExprNode, scope: EvaluationScope): unknown {
  switch (node.kind) {
    case 'literal':
      return node.value;
    case 'path':
      return resolvePath(node.path, scope);
    case 'op':
      return executeOperator(node.op, node.args, scope);
  }
}
