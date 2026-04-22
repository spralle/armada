import type { ExprNode } from './ast.js';
import { PredicateError } from './errors.js';
import { compile, type Query } from './compile.js';
import type { TypedQuery } from './typed-query.js';
import { PATH_MISSING, validateAndSplitPath, assertComparableTypes, collectPath, collectArrayLeaves, normalizeComparable } from './path-utils.js';
import type { OperatorRegistry } from './operators.js';
import { clearRegexCache, getRegexCacheSize, getCachedRegex } from './regex-cache.js';

export { clearRegexCache, getRegexCacheSize };

/** Predicate function that tests a document against a compiled query. */
export type FilterFn<T = Record<string, unknown>> = (doc: Readonly<T>) => boolean;

/** Options for compiling a filter from a query or AST. */
export interface CompileFilterOptions {
  readonly registry?: OperatorRegistry;
  readonly maxDepth?: number;
}

/** Boolean predicate closure (filter operators). */
type BoolScopeFn = (scope: Record<string, unknown>) => boolean;
/** Value-resolving closure (paths, literals). */
type ValScopeFn = (scope: Record<string, unknown>) => unknown;
function compilePath(node: ExprNode & { kind: 'path' }): ValScopeFn {
  const segments = validateAndSplitPath(node.path);
  if (segments.length === 1) {
    const key = segments[0]!;
    return (scope) => scope[key];
  }
  return (scope) => collectPath(scope, segments);
}

function compilePathWithMissing(node: ExprNode & { kind: 'path' }): ValScopeFn {
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
function compileLiteral(node: ExprNode & { kind: 'literal' }): ValScopeFn {
  const val = node.value;
  return () => val;
}

// ---------------------------------------------------------------------------
// Operator compilation
// ---------------------------------------------------------------------------
function compileComparison(op: string, args: readonly ExprNode[]): BoolScopeFn {
  const resolveA = compileArgWithMissing(args[0]!);
  const bNode = args[1]!;
  const isLiteral = bNode.kind === 'literal';

  if (op === '$eq') {
    if (isLiteral) {
      const bVal = bNode.value;
      return (scope) => {
        const a = resolveA(scope);
        if (a === PATH_MISSING) return bVal === undefined;
        if (Array.isArray(a)) return a.some((v) => normalizeComparable(v) === bVal);
        return normalizeComparable(a) === bVal;
      };
    }
    const resolveB = compileArgWithMissing(bNode);
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
    if (isLiteral) {
      const bVal = bNode.value;
      return (scope) => {
        const a = resolveA(scope);
        if (a === PATH_MISSING) return bVal !== undefined;
        if (Array.isArray(a)) return !a.some((v) => normalizeComparable(v) === bVal);
        return normalizeComparable(a) !== bVal;
      };
    }
    const resolveB = compileArgWithMissing(bNode);
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
  if (isLiteral) {
    const bVal = bNode.value as number | string;
    return (scope) => {
      const a = resolveA(scope);
      if (a === PATH_MISSING) return false;
      if (Array.isArray(a)) {
        return a.some((v) => {
          const nv = normalizeComparable(v);
          return typeof nv === typeof bVal && cmpFn(nv, bVal);
        });
      }
      const na = normalizeComparable(a);
      if (typeof na !== typeof bVal || (typeof na !== 'number' && typeof na !== 'string')) {
        throw new PredicateError(
          'FORMR_EXPR_TYPE_MISMATCH',
          `${op} requires operands of the same type (number or string), got ${typeof na} and ${typeof bVal}`,
        );
      }
      return cmpFn(na, bVal);
    };
  }
  const resolveB = compileArgWithMissing(bNode);
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

function buildCmpFn(op: string): (a: unknown, b: unknown) => boolean {
  switch (op) {
    case '$gt': return (a, b) => (a as number | string) > (b as number | string);
    case '$gte': return (a, b) => (a as number | string) >= (b as number | string);
    case '$lt': return (a, b) => (a as number | string) < (b as number | string);
    case '$lte': return (a, b) => (a as number | string) <= (b as number | string);
    default: throw new PredicateError('PREDICATE_UNKNOWN_OPERATOR', `Unknown comparison: ${op}`);
  }
}

function compileInclusion(args: readonly ExprNode[], negate: boolean): BoolScopeFn {
  const resolveValue = compileNode(args[0]!);
  const listNode = args[1]!;
  if (listNode.kind === 'literal' && Array.isArray(listNode.value)) {
    const set = new Set(listNode.value as unknown[]);
    return (scope) => {
      const v = resolveValue(scope);
      const found = Array.isArray(v) ? v.some((el) => set.has(el)) : set.has(v);
      return negate ? !found : found;
    };
  }
  const resolveList = compileNode(listNode);
  const opName = negate ? '$nin' : '$in';
  return (scope) => {
    const arr = resolveList(scope);
    if (!Array.isArray(arr)) {
      throw new PredicateError('FORMR_EXPR_TYPE_MISMATCH', `${opName} requires second argument to be an array`);
    }
    const v = resolveValue(scope);
    const found = Array.isArray(v) ? v.some((el) => arr.includes(el)) : arr.includes(v);
    return negate ? !found : found;
  };
}

function compileRegex(args: readonly ExprNode[]): BoolScopeFn {
  const resolveTarget = compileNode(args[0]!);
  const patternNode = args[1]!;
  const flagsNode = args.length > 2 ? args[2] : undefined;
  const pattern = patternNode.kind === 'literal' ? String(patternNode.value) : null;
  const flags = flagsNode?.kind === 'literal' ? String(flagsNode.value) : undefined;

  if (pattern !== null) {
    const re = getCachedRegex(pattern, flags);
    const needsReset = re.global || re.sticky;
    return (scope) => {
      const target = resolveTarget(scope);
      if (needsReset) re.lastIndex = 0;
      if (Array.isArray(target)) return target.some((v) => {
        if (typeof v !== 'string') return false;
        if (needsReset) re.lastIndex = 0;
        return re.test(v);
      });
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
    const needsReset = re.global || re.sticky;
    if (needsReset) re.lastIndex = 0;
    if (Array.isArray(target)) return target.some((v) => {
      if (typeof v !== 'string') return false;
      if (needsReset) re.lastIndex = 0;
      return re.test(v);
    });
    if (typeof target !== 'string') return false;
    return re.test(target);
  };
}

function compileExists(args: readonly ExprNode[]): BoolScopeFn {
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

function compileElemMatch(args: readonly ExprNode[], registry?: OperatorRegistry): BoolScopeFn {
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

function compileAll(args: readonly ExprNode[]): BoolScopeFn {
  const resolveValue = compileNode(args[0]!);
  const listNode = args[1]!;
  if (listNode.kind === 'literal' && Array.isArray(listNode.value)) {
    const required = listNode.value as readonly unknown[];
    return (scope) => {
      const v = resolveValue(scope);
      if (!Array.isArray(v)) return false;
      return required.every((item) => v.includes(item));
    };
  }
  const resolveList = compileNode(listNode);
  return (scope) => {
    const v = resolveValue(scope);
    if (!Array.isArray(v)) return false;
    const required = resolveList(scope);
    if (!Array.isArray(required)) {
      throw new PredicateError('FORMR_EXPR_TYPE_MISMATCH', '$all requires an array argument');
    }
    return required.every((item) => v.includes(item));
  };
}

function compileSize(args: readonly ExprNode[]): BoolScopeFn {
  const resolveValue = compileNode(args[0]!);
  const sizeNode = args[1]!;
  if (sizeNode.kind === 'literal' && typeof sizeNode.value === 'number') {
    const expected = sizeNode.value;
    return (scope) => {
      const v = resolveValue(scope);
      if (!Array.isArray(v)) return false;
      return v.length === expected;
    };
  }
  const resolveSize = compileNode(sizeNode);
  return (scope) => {
    const v = resolveValue(scope);
    if (!Array.isArray(v)) return false;
    return v.length === resolveSize(scope);
  };
}

function compileOp(node: ExprNode & { kind: 'op' }, registry?: OperatorRegistry): BoolScopeFn | ValScopeFn {
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
  if (op === '$in') return compileInclusion(args, false);
  if (op === '$nin') return compileInclusion(args, true);
  if (op === '$regex') return compileRegex(args);
  if (op === '$exists') return compileExists(args);
  if (op === '$elemMatch') return compileElemMatch(args, registry);
  if (op === '$all') return compileAll(args);
  if (op === '$size') return compileSize(args);

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

function compileNode(node: ExprNode, registry?: OperatorRegistry): BoolScopeFn | ValScopeFn {
  switch (node.kind) {
    case 'literal': return compileLiteral(node);
    case 'path': return compilePath(node);
    case 'op': return compileOp(node, registry);
  }
}

/** Compile arg with MISSING sentinel for comparison operators. */
function compileArgWithMissing(node: ExprNode): ValScopeFn {
  if (node.kind === 'path') return compilePathWithMissing(node);
  return compileNode(node);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Compile a MongoDB-style query to an optimized native filter function. */
export function compileFilter<T>(query: TypedQuery<T>, options?: CompileFilterOptions): FilterFn<T>;
export function compileFilter(query: Query, options?: CompileFilterOptions): FilterFn;
export function compileFilter(query: Query, options?: CompileFilterOptions): FilterFn {
  const ast = compile(query);
  return compileFilterFromAst(ast, options);
}

/** Compile an existing AST to an optimized native filter function. */
export function compileFilterFromAst(ast: ExprNode, options?: CompileFilterOptions): FilterFn {
  const inner = compileNode(ast, options?.registry);
  return (doc) => Boolean(inner(doc as Record<string, unknown>));
}

/** Compile an AST to a raw scope function (returns unknown, not boolean). */
export function compileRawFromAst(ast: ExprNode, options?: CompileFilterOptions): (doc: Readonly<Record<string, unknown>>) => unknown {
  if (options?.maxDepth !== undefined) {
    assertAstDepth(ast, options.maxDepth);
  }
  return compileNode(ast, options?.registry);
}

// ---------------------------------------------------------------------------
// AST depth validation
// ---------------------------------------------------------------------------

function astDepth(node: ExprNode): number {
  if (node.kind !== 'op') return 0;
  let max = 0;
  for (const arg of node.args) {
    const d = astDepth(arg);
    if (d > max) max = d;
  }
  return max + 1;
}

function assertAstDepth(node: ExprNode, maxDepth: number): void {
  if (astDepth(node) > maxDepth) {
    throw new PredicateError(
      'PREDICATE_DEPTH_EXCEEDED',
      `Expression exceeded maximum depth of ${String(maxDepth)}`,
    );
  }
}
