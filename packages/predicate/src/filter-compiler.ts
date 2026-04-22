import type { ExprNode } from './ast.js';
import { PredicateError } from './errors.js';
import { compile, type Query } from './compile.js';
import { PATH_MISSING, validateAndSplitPath, assertComparableTypes, collectPath, collectArrayLeaves, normalizeComparable } from './path-utils.js';
import type { OperatorRegistry } from './operators.js';

export type FilterFn = (doc: Readonly<Record<string, unknown>>) => boolean;

export interface CompileFilterOptions {
  readonly registry?: OperatorRegistry;
}

type ScopeFn = (scope: Record<string, unknown>) => unknown;

// ---------------------------------------------------------------------------
// Regex LRU cache
// ---------------------------------------------------------------------------

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
    regexCache.delete(key);
    regexCache.set(key, existing);
    return existing;
  }
  const re = new RegExp(pattern, flags);
  if (regexCache.size >= REGEX_CACHE_MAX) {
    const oldest = regexCache.keys().next().value;
    if (oldest !== undefined) regexCache.delete(oldest);
  }
  regexCache.set(key, re);
  return re;
}

// ---------------------------------------------------------------------------
// Path compilation
// ---------------------------------------------------------------------------

function compilePath(node: ExprNode & { kind: 'path' }): ScopeFn {
  const segments = validateAndSplitPath(node.path);
  if (segments.length === 1) {
    const key = segments[0]!;
    return (scope) => scope[key];
  }
  return (scope) => collectPath(scope, segments);
}

function compilePathWithMissing(node: ExprNode & { kind: 'path' }): ScopeFn {
  const segments = validateAndSplitPath(node.path);
  if (segments.length === 1) {
    const key = segments[0]!;
    return (scope) => (key in scope ? scope[key] : PATH_MISSING);
  }
  return (scope) => {
    const result = collectPath(scope, segments);
    return result === undefined ? PATH_MISSING : result;
  };
}

// ---------------------------------------------------------------------------
// Literal compilation
// ---------------------------------------------------------------------------

function compileLiteral(node: ExprNode & { kind: 'literal' }): ScopeFn {
  const val = node.value;
  return () => val;
}

// ---------------------------------------------------------------------------
// Operator compilation
// ---------------------------------------------------------------------------

function compileComparison(op: string, args: readonly ExprNode[]): ScopeFn {
  const resolveA = compileArgWithMissing(args[0]!);
  const resolveB = compileArgWithMissing(args[1]!);

  if (op === '$eq') {
    return (scope) => {
      const a = resolveA(scope);
      const b = resolveB(scope);
      if (a === PATH_MISSING && b === PATH_MISSING) return true;
      if (a === PATH_MISSING) return b === undefined;
      if (b === PATH_MISSING) return a === undefined;
      if (Array.isArray(a)) return a.some((v) => normalizeComparable(v) === normalizeComparable(b));
      return normalizeComparable(a) === normalizeComparable(b);
    };
  }
  if (op === '$ne') {
    return (scope) => {
      const a = resolveA(scope);
      const b = resolveB(scope);
      if (a === PATH_MISSING && b === PATH_MISSING) return false;
      if (a === PATH_MISSING) return b !== undefined;
      if (b === PATH_MISSING) return a !== undefined;
      if (Array.isArray(a)) return !a.some((v) => normalizeComparable(v) === normalizeComparable(b));
      return normalizeComparable(a) !== normalizeComparable(b);
    };
  }
  // $gt, $gte, $lt, $lte
  const cmpFn = buildCmpFn(op);
  return (scope) => {
    const a = resolveA(scope);
    const b = resolveB(scope);
    if (a === PATH_MISSING || b === PATH_MISSING) return false;
    if (Array.isArray(a)) {
      const nb = normalizeComparable(b);
      return a.some((v) => {
        const nv = normalizeComparable(v);
        return typeof nv === typeof nb && cmpFn(nv, nb);
      });
    }
    assertComparableTypes(a, b, op);
    return cmpFn(normalizeComparable(a), normalizeComparable(b));
  };
}

function buildCmpFn(op: string): (a: number | string, b: number | string) => boolean {
  switch (op) {
    case '$gt': return (a, b) => a > b;
    case '$gte': return (a, b) => a >= b;
    case '$lt': return (a, b) => a < b;
    case '$lte': return (a, b) => a <= b;
    default: throw new PredicateError('PREDICATE_UNKNOWN_OPERATOR', `Unknown comparison: ${op}`);
  }
}

function compileIn(args: readonly ExprNode[]): ScopeFn {
  const resolveValue = compileNode(args[0]!);
  const listNode = args[1]!;
  if (listNode.kind === 'literal' && Array.isArray(listNode.value)) {
    const set = new Set(listNode.value as unknown[]);
    return (scope) => {
      const v = resolveValue(scope);
      if (Array.isArray(v)) return v.some((el) => set.has(el));
      return set.has(v);
    };
  }
  const resolveList = compileNode(listNode);
  return (scope) => {
    const arr = resolveList(scope);
    if (!Array.isArray(arr)) {
      throw new PredicateError('FORMR_EXPR_TYPE_MISMATCH', '$in requires second argument to be an array');
    }
    const v = resolveValue(scope);
    if (Array.isArray(v)) return v.some((el) => arr.includes(el));
    return arr.includes(v);
  };
}

function compileNin(args: readonly ExprNode[]): ScopeFn {
  const resolveValue = compileNode(args[0]!);
  const listNode = args[1]!;
  if (listNode.kind === 'literal' && Array.isArray(listNode.value)) {
    const set = new Set(listNode.value as unknown[]);
    return (scope) => {
      const v = resolveValue(scope);
      if (Array.isArray(v)) return !v.some((el) => set.has(el));
      return !set.has(v);
    };
  }
  const resolveList = compileNode(listNode);
  return (scope) => {
    const arr = resolveList(scope);
    if (!Array.isArray(arr)) {
      throw new PredicateError('FORMR_EXPR_TYPE_MISMATCH', '$nin requires second argument to be an array');
    }
    const v = resolveValue(scope);
    if (Array.isArray(v)) return !v.some((el) => arr.includes(el));
    return !arr.includes(v);
  };
}

function compileRegex(args: readonly ExprNode[]): ScopeFn {
  const resolveTarget = compileNode(args[0]!);
  const patternNode = args[1]!;
  const flagsNode = args.length > 2 ? args[2] : undefined;
  const pattern = patternNode.kind === 'literal' ? String(patternNode.value) : null;
  const flags = flagsNode?.kind === 'literal' ? String(flagsNode.value) : undefined;

  if (pattern !== null) {
    const re = getCachedRegex(pattern, flags);
    return (scope) => {
      const target = resolveTarget(scope);
      if (Array.isArray(target)) return target.some((v) => typeof v === 'string' && re.test(v));
      if (typeof target !== 'string') return false;
      return re.test(target);
    };
  }
  const resolvePattern = compileNode(patternNode);
  return (scope) => {
    const target = resolveTarget(scope);
    const pat = resolvePattern(scope);
    if (typeof pat !== 'string') {
      throw new PredicateError('FORMR_EXPR_TYPE_MISMATCH', '$regex requires string operands');
    }
    const re = getCachedRegex(pat, flags);
    if (Array.isArray(target)) return target.some((v) => typeof v === 'string' && re.test(v));
    if (typeof target !== 'string') return false;
    return re.test(target);
  };
}

function compileExists(args: readonly ExprNode[]): ScopeFn {
  const resolvePath = args[0]!.kind === 'path'
    ? compilePathWithMissing(args[0] as ExprNode & { kind: 'path' })
    : compileNode(args[0]!);
  const expectedNode = args[1]!;
  const expected = expectedNode.kind === 'literal' ? Boolean(expectedNode.value) : true;

  return (scope) => {
    const resolved = resolvePath(scope);
    const exists = resolved !== PATH_MISSING;
    return expected ? exists : !exists;
  };
}

function compileElemMatch(args: readonly ExprNode[], registry?: OperatorRegistry): ScopeFn {
  const pathNode = args[0]!;
  const subFilter = compileNode(args[1]!, registry);

  // For dotted paths, use collectArrayLeaves to mirror kuery's lastPathMustBeArray behavior
  if (pathNode.kind === 'path' && pathNode.path.includes('.')) {
    const segments = validateAndSplitPath(pathNode.path);
    return (scope) => {
      const arrays = collectArrayLeaves(scope, segments);
      return arrays.some((arr) =>
        arr.some((el) => Boolean(subFilter(el as Record<string, unknown>))),
      );
    };
  }

  // Simple (non-dotted) path: resolve directly and check if it's an array
  const resolvePath = pathNode.kind === 'path'
    ? compilePath(pathNode as ExprNode & { kind: 'path' })
    : compileNode(pathNode);
  return (scope) => {
    const arr = resolvePath(scope);
    if (!Array.isArray(arr)) return false;
    return arr.some((el) => Boolean(subFilter(el as Record<string, unknown>)));
  };
}

function compileOp(node: ExprNode & { kind: 'op' }, registry?: OperatorRegistry): ScopeFn {
  const { op, args } = node;

  if (op === '$eq' || op === '$ne' || op === '$gt' || op === '$gte' || op === '$lt' || op === '$lte') {
    return compileComparison(op, args);
  }
  if (op === '$and') {
    const compiled = args.map((a) => compileNode(a, registry));
    return (scope) => compiled.every((fn) => Boolean(fn(scope)));
  }
  if (op === '$or') {
    const compiled = args.map((a) => compileNode(a, registry));
    return (scope) => compiled.some((fn) => Boolean(fn(scope)));
  }
  if (op === '$not') {
    const inner = compileNode(args[0]!, registry);
    return (scope) => !inner(scope);
  }
  if (op === '$in') return compileIn(args);
  if (op === '$nin') return compileNin(args);
  if (op === '$regex') return compileRegex(args);
  if (op === '$exists') return compileExists(args);
  if (op === '$elemMatch') return compileElemMatch(args, registry);

  if (registry) {
    const handler = registry.getHandler(op);
    if (handler) {
      const compiledArgs = args.map((a) => compileNode(a, registry));
      return (scope) => handler(compiledArgs.map((fn) => fn(scope)), scope);
    }
  }

  throw new PredicateError('PREDICATE_UNKNOWN_OPERATOR', `Unknown operator: ${op}`);
}

// ---------------------------------------------------------------------------
// Node dispatch
// ---------------------------------------------------------------------------

function compileNode(node: ExprNode, registry?: OperatorRegistry): ScopeFn {
  switch (node.kind) {
    case 'literal': return compileLiteral(node);
    case 'path': return compilePath(node);
    case 'op': return compileOp(node, registry);
  }
}

/** Compile arg with MISSING sentinel for comparison operators. */
function compileArgWithMissing(node: ExprNode): ScopeFn {
  if (node.kind === 'path') return compilePathWithMissing(node);
  return compileNode(node);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Compile a MongoDB-style query to an optimized native filter function. */
export function compileFilter(query: Query): FilterFn {
  const ast = compile(query);
  return compileFilterFromAst(ast);
}

/** Compile an existing AST to an optimized native filter function. */
export function compileFilterFromAst(ast: ExprNode, options?: CompileFilterOptions): FilterFn {
  const inner = compileNode(ast, options?.registry);
  return (doc) => Boolean(inner(doc as Record<string, unknown>));
}

/** Compile an AST to a raw scope function (returns unknown, not boolean). */
export function compileRawFromAst(ast: ExprNode, options?: CompileFilterOptions): (doc: Readonly<Record<string, unknown>>) => unknown {
  return compileNode(ast, options?.registry);
}
