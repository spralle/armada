import type { ExprNode, EvaluationScope } from './ast.js';
import { PredicateError } from './errors.js';
import { assertSafeSegment } from './safe-path.js';

export type { EvaluationScope } from './ast.js';

const DEFAULT_MAX_DEPTH = 256;

export interface EvaluateOptions {
  readonly maxDepth?: number;
}

const MISSING = Symbol('MISSING');

function resolvePath(path: string, scope: EvaluationScope): unknown {
  const segments = path.split('.');
  let current: unknown = scope;
  for (const segment of segments) {
    assertSafeSegment(segment);
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

function resolveArg(
  node: ExprNode,
  scope: EvaluationScope,
  depth: number,
  maxDepth: number,
): unknown | typeof MISSING {
  if (node.kind === 'path') {
    const result = resolvePath(node.path, scope);
    return result === undefined ? MISSING : result;
  }
  return evaluateInner(node, scope, depth, maxDepth);
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

function executeOperator(
  op: string,
  args: readonly ExprNode[],
  scope: EvaluationScope,
  depth: number,
  maxDepth: number,
): unknown {
  switch (op) {
    case '$eq': {
      const a = resolveArg(args[0], scope, depth, maxDepth);
      const b = resolveArg(args[1], scope, depth, maxDepth);
      if (a === MISSING && b === MISSING) return true;
      if (a === MISSING) return b === undefined;
      if (b === MISSING) return a === undefined;
      return a === b;
    }
    case '$ne': {
      const a = resolveArg(args[0], scope, depth, maxDepth);
      const b = resolveArg(args[1], scope, depth, maxDepth);
      if (a === MISSING && b === MISSING) return false;
      if (a === MISSING) return b !== undefined;
      if (b === MISSING) return a !== undefined;
      return !(a === b);
    }
    case '$gt': {
      const a = resolveArg(args[0], scope, depth, maxDepth);
      const b = resolveArg(args[1], scope, depth, maxDepth);
      if (a === MISSING || b === MISSING) return false;
      assertComparableTypes(a, b, '$gt');
      return (a as number | string) > (b as number | string);
    }
    case '$gte': {
      const a = resolveArg(args[0], scope, depth, maxDepth);
      const b = resolveArg(args[1], scope, depth, maxDepth);
      if (a === MISSING || b === MISSING) return false;
      assertComparableTypes(a, b, '$gte');
      return (a as number | string) >= (b as number | string);
    }
    case '$lt': {
      const a = resolveArg(args[0], scope, depth, maxDepth);
      const b = resolveArg(args[1], scope, depth, maxDepth);
      if (a === MISSING || b === MISSING) return false;
      assertComparableTypes(a, b, '$lt');
      return (a as number | string) < (b as number | string);
    }
    case '$lte': {
      const a = resolveArg(args[0], scope, depth, maxDepth);
      const b = resolveArg(args[1], scope, depth, maxDepth);
      if (a === MISSING || b === MISSING) return false;
      assertComparableTypes(a, b, '$lte');
      return (a as number | string) <= (b as number | string);
    }
    case '$and':
      return args.every((arg) => Boolean(evaluateInner(arg, scope, depth, maxDepth)));
    case '$or':
      return args.some((arg) => Boolean(evaluateInner(arg, scope, depth, maxDepth)));
    case '$not':
      return !evaluateInner(args[0], scope, depth, maxDepth);
    case '$in': {
      const value = evaluateInner(args[0], scope, depth, maxDepth);
      const list = evaluateInner(args[1], scope, depth, maxDepth);
      if (!Array.isArray(list)) {
        throw new PredicateError(
          'FORMR_EXPR_TYPE_MISMATCH',
          '$in requires second argument to be an array',
        );
      }
      return list.includes(value);
    }
    case '$nin': {
      const value = evaluateInner(args[0], scope, depth, maxDepth);
      const list = evaluateInner(args[1], scope, depth, maxDepth);
      if (!Array.isArray(list)) {
        throw new PredicateError(
          'FORMR_EXPR_TYPE_MISMATCH',
          '$nin requires second argument to be an array',
        );
      }
      return !list.includes(value);
    }
    case '$exists': {
      const resolved = resolveArg(args[0], scope, depth, maxDepth);
      const expected = evaluateInner(args[1], scope, depth, maxDepth);
      const exists = resolved !== MISSING;
      return expected ? exists : !exists;
    }
    default:
      throw new PredicateError(
        'PREDICATE_UNKNOWN_OPERATOR',
        `Unknown operator: ${op}`,
      );
  }
}

function evaluateInner(
  node: ExprNode,
  scope: EvaluationScope,
  depth: number,
  maxDepth: number,
): unknown {
  if (depth > maxDepth) {
    throw new PredicateError(
      'PREDICATE_DEPTH_EXCEEDED',
      `Expression evaluation exceeded maximum depth of ${String(maxDepth)}`,
    );
  }
  switch (node.kind) {
    case 'literal':
      return node.value;
    case 'path':
      return resolvePath(node.path, scope);
    case 'op':
      return executeOperator(node.op, node.args, scope, depth + 1, maxDepth);
  }
}

export function evaluate(
  node: ExprNode,
  scope: EvaluationScope,
  options?: EvaluateOptions,
): unknown {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  return evaluateInner(node, scope, 0, maxDepth);
}
