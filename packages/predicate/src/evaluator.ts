import type { ExprNode, EvaluationScope } from './ast.js';
import { PredicateError } from './errors.js';
import { assertSafeSegment } from './safe-path.js';
import type { OperatorRegistry } from './operators.js';

export type { EvaluationScope } from './ast.js';

const DEFAULT_MAX_DEPTH = 256;

export interface EvaluateOptions {
  readonly maxDepth?: number;
  readonly operators?: OperatorRegistry;
}

const MISSING = Symbol('MISSING');

const REGEX_CACHE_MAX = 256;
const regexCache = new Map<string, RegExp>();

/** Clear the regex cache (useful for testing and memory cleanup). */
export function clearRegexCache(): void {
  regexCache.clear();
}

/** Visible for testing — returns current regex cache size. */
export function getRegexCacheSize(): number {
  return regexCache.size;
}

function getCachedRegex(pattern: string, flags?: string): RegExp {
  const key = flags ? `${pattern}\0${flags}` : pattern;
  const existing = regexCache.get(key);
  if (existing) {
    // Move to end (most recently used)
    regexCache.delete(key);
    regexCache.set(key, existing);
    return existing;
  }
  const re = new RegExp(pattern, flags);
  if (regexCache.size >= REGEX_CACHE_MAX) {
    // Evict oldest (first key)
    const oldest = regexCache.keys().next().value;
    if (oldest !== undefined) regexCache.delete(oldest);
  }
  regexCache.set(key, re);
  return re;
}

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
  registry?: OperatorRegistry,
): unknown | typeof MISSING {
  if (node.kind === 'path') {
    const result = resolvePath(node.path, scope);
    return result === undefined ? MISSING : result;
  }
  return evaluateInner(node, scope, depth, maxDepth, registry);
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

function executeComparisonOp(
  op: string,
  args: readonly ExprNode[],
  scope: EvaluationScope,
  depth: number,
  maxDepth: number,
  registry?: OperatorRegistry,
): unknown {
  const a = resolveArg(args[0], scope, depth, maxDepth, registry);
  const b = resolveArg(args[1], scope, depth, maxDepth, registry);

  switch (op) {
    case '$eq': {
      if (a === MISSING && b === MISSING) return true;
      if (a === MISSING) return b === undefined;
      if (b === MISSING) return a === undefined;
      return a === b;
    }
    case '$ne': {
      if (a === MISSING && b === MISSING) return false;
      if (a === MISSING) return b !== undefined;
      if (b === MISSING) return a !== undefined;
      return !(a === b);
    }
    case '$gt': {
      if (a === MISSING || b === MISSING) return false;
      assertComparableTypes(a, b, '$gt');
      return (a as number | string) > (b as number | string);
    }
    case '$gte': {
      if (a === MISSING || b === MISSING) return false;
      assertComparableTypes(a, b, '$gte');
      return (a as number | string) >= (b as number | string);
    }
    case '$lt': {
      if (a === MISSING || b === MISSING) return false;
      assertComparableTypes(a, b, '$lt');
      return (a as number | string) < (b as number | string);
    }
    case '$lte': {
      if (a === MISSING || b === MISSING) return false;
      assertComparableTypes(a, b, '$lte');
      return (a as number | string) <= (b as number | string);
    }
    default:
      return undefined;
  }
}

function executeLogicalOp(
  op: string,
  args: readonly ExprNode[],
  scope: EvaluationScope,
  depth: number,
  maxDepth: number,
  registry?: OperatorRegistry,
): unknown {
  switch (op) {
    case '$and':
      return args.every((arg) => Boolean(evaluateInner(arg, scope, depth, maxDepth, registry)));
    case '$or':
      return args.some((arg) => Boolean(evaluateInner(arg, scope, depth, maxDepth, registry)));
    case '$not':
      return !evaluateInner(args[0], scope, depth, maxDepth, registry);
    default:
      return undefined;
  }
}

function executeCollectionOp(
  op: string,
  args: readonly ExprNode[],
  scope: EvaluationScope,
  depth: number,
  maxDepth: number,
  registry?: OperatorRegistry,
): unknown {
  const value = evaluateInner(args[0], scope, depth, maxDepth, registry);
  const list = evaluateInner(args[1], scope, depth, maxDepth, registry);
  if (!Array.isArray(list)) {
    throw new PredicateError(
      'FORMR_EXPR_TYPE_MISMATCH',
      `${op} requires second argument to be an array`,
    );
  }
  return op === '$in' ? list.includes(value) : !list.includes(value);
}

function executeOperator(
  op: string,
  args: readonly ExprNode[],
  scope: EvaluationScope,
  depth: number,
  maxDepth: number,
  registry?: OperatorRegistry,
): unknown {
  if (registry) {
    const handler = registry.getHandler(op);
    if (handler) {
      const resolved = args.map((a) => evaluateInner(a, scope, depth, maxDepth, registry));
      return handler(resolved, scope as Record<string, unknown>);
    }
  }

  if (op === '$eq' || op === '$ne' || op === '$gt' || op === '$gte' || op === '$lt' || op === '$lte') {
    return executeComparisonOp(op, args, scope, depth, maxDepth, registry);
  }

  if (op === '$and' || op === '$or' || op === '$not') {
    return executeLogicalOp(op, args, scope, depth, maxDepth, registry);
  }

  if (op === '$in' || op === '$nin') {
    return executeCollectionOp(op, args, scope, depth, maxDepth, registry);
  }

  switch (op) {
    case '$exists': {
      const resolved = resolveArg(args[0], scope, depth, maxDepth, registry);
      const expected = evaluateInner(args[1], scope, depth, maxDepth, registry);
      const exists = resolved !== MISSING;
      return expected ? exists : !exists;
    }
    case '$regex': {
      const target = evaluateInner(args[0], scope, depth, maxDepth, registry);
      const pattern = evaluateInner(args[1], scope, depth, maxDepth, registry);
      if (typeof target !== 'string' || typeof pattern !== 'string') {
        throw new PredicateError(
          'FORMR_EXPR_TYPE_MISMATCH',
          '$regex requires string operands',
        );
      }
      const flags = args.length > 2
        ? evaluateInner(args[2], scope, depth, maxDepth, registry)
        : undefined;
      const flagStr = typeof flags === 'string' ? flags : undefined;
      return getCachedRegex(pattern, flagStr).test(target);
    }
    case '$elemMatch': {
      const arr = resolveArg(args[0], scope, depth, maxDepth, registry);
      if (arr === MISSING || !Array.isArray(arr)) return false;
      const subQuery = args[1];
      return arr.some((element) => {
        return Boolean(evaluateInner(subQuery, element as EvaluationScope, depth + 1, maxDepth, registry));
      });
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
  registry?: OperatorRegistry,
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
      return executeOperator(node.op, node.args, scope, depth + 1, maxDepth, registry);
  }
}

export function evaluate(
  node: ExprNode,
  scope: EvaluationScope,
  options?: EvaluateOptions,
): unknown {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  return evaluateInner(node, scope, 0, maxDepth, options?.operators);
}
