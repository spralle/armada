import type { ExprNode } from './ast.js';
import { PredicateError } from './errors.js';
import { assertSafeSegment } from './safe-path.js';
import { compileShorthand, type ShorthandQuery } from './shorthand.js';

export type FilterFn = (doc: Readonly<Record<string, unknown>>) => boolean;

type ScopeFn = (scope: Record<string, unknown>) => unknown;

const PATH_MISSING = Symbol('PATH_MISSING');

// ---------------------------------------------------------------------------
// Path compilation
// ---------------------------------------------------------------------------

function validateAndSplitPath(path: string): readonly string[] {
  const segments = path.split('.');
  for (const seg of segments) assertSafeSegment(seg);
  return segments;
}

function compilePath(node: ExprNode & { kind: 'path' }): ScopeFn {
  const segments = validateAndSplitPath(node.path);
  if (segments.length === 1) {
    const key = segments[0]!;
    return (scope) => scope[key];
  }
  return (scope) => {
    let current: unknown = scope;
    for (let i = 0; i < segments.length; i++) {
      if (current === null || current === undefined || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[segments[i]!];
    }
    return current;
  };
}

function compilePathWithMissing(node: ExprNode & { kind: 'path' }): ScopeFn {
  const segments = validateAndSplitPath(node.path);
  if (segments.length === 1) {
    const key = segments[0]!;
    return (scope) => (key in scope ? scope[key] : PATH_MISSING);
  }
  return (scope) => {
    let current: unknown = scope;
    for (let i = 0; i < segments.length; i++) {
      if (current === null || current === undefined || typeof current !== 'object') return PATH_MISSING;
      const seg = segments[i]!;
      if (!(seg in (current as Record<string, unknown>))) return PATH_MISSING;
      current = (current as Record<string, unknown>)[seg];
    }
    return current;
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
      return a === b;
    };
  }
  if (op === '$ne') {
    return (scope) => {
      const a = resolveA(scope);
      const b = resolveB(scope);
      if (a === PATH_MISSING && b === PATH_MISSING) return false;
      if (a === PATH_MISSING) return b !== undefined;
      if (b === PATH_MISSING) return a !== undefined;
      return a !== b;
    };
  }
  // $gt, $gte, $lt, $lte
  const cmpFn = buildCmpFn(op);
  return (scope) => {
    const a = resolveA(scope);
    const b = resolveB(scope);
    if (a === PATH_MISSING || b === PATH_MISSING) return false;
    assertComparableTypes(a, b, op);
    return cmpFn(a as number | string, b as number | string);
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

function compileIn(args: readonly ExprNode[]): ScopeFn {
  const resolveValue = compileNode(args[0]!);
  const listNode = args[1]!;
  if (listNode.kind === 'literal' && Array.isArray(listNode.value)) {
    const set = new Set(listNode.value as unknown[]);
    return (scope) => set.has(resolveValue(scope));
  }
  const resolveList = compileNode(listNode);
  return (scope) => {
    const arr = resolveList(scope);
    if (!Array.isArray(arr)) {
      throw new PredicateError('FORMR_EXPR_TYPE_MISMATCH', '$in requires second argument to be an array');
    }
    return arr.includes(resolveValue(scope));
  };
}

function compileNin(args: readonly ExprNode[]): ScopeFn {
  const resolveValue = compileNode(args[0]!);
  const listNode = args[1]!;
  if (listNode.kind === 'literal' && Array.isArray(listNode.value)) {
    const set = new Set(listNode.value as unknown[]);
    return (scope) => !set.has(resolveValue(scope));
  }
  const resolveList = compileNode(listNode);
  return (scope) => {
    const arr = resolveList(scope);
    if (!Array.isArray(arr)) {
      throw new PredicateError('FORMR_EXPR_TYPE_MISMATCH', '$nin requires second argument to be an array');
    }
    return !arr.includes(resolveValue(scope));
  };
}

function compileRegex(args: readonly ExprNode[]): ScopeFn {
  const resolveTarget = compileNode(args[0]!);
  const patternNode = args[1]!;
  const flagsNode = args.length > 2 ? args[2] : undefined;
  const pattern = patternNode.kind === 'literal' ? String(patternNode.value) : null;
  const flags = flagsNode?.kind === 'literal' ? String(flagsNode.value) : undefined;

  if (pattern !== null) {
    const re = new RegExp(pattern, flags);
    return (scope) => {
      const target = resolveTarget(scope);
      if (typeof target !== 'string') {
        throw new PredicateError('FORMR_EXPR_TYPE_MISMATCH', '$regex requires string operands');
      }
      return re.test(target);
    };
  }
  const resolvePattern = compileNode(patternNode);
  return (scope) => {
    const target = resolveTarget(scope);
    const pat = resolvePattern(scope);
    if (typeof target !== 'string' || typeof pat !== 'string') {
      throw new PredicateError('FORMR_EXPR_TYPE_MISMATCH', '$regex requires string operands');
    }
    return new RegExp(pat, flags).test(target);
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

function compileElemMatch(args: readonly ExprNode[]): ScopeFn {
  const resolvePath = args[0]!.kind === 'path'
    ? compilePath(args[0] as ExprNode & { kind: 'path' })
    : compileNode(args[0]!);
  const subFilter = compileNode(args[1]!);
  return (scope) => {
    const arr = resolvePath(scope);
    if (!Array.isArray(arr)) return false;
    return arr.some((el) => Boolean(subFilter(el as Record<string, unknown>)));
  };
}

function compileOp(node: ExprNode & { kind: 'op' }): ScopeFn {
  const { op, args } = node;

  if (op === '$eq' || op === '$ne' || op === '$gt' || op === '$gte' || op === '$lt' || op === '$lte') {
    return compileComparison(op, args);
  }
  if (op === '$and') {
    const compiled = args.map(compileNode);
    return (scope) => compiled.every((fn) => Boolean(fn(scope)));
  }
  if (op === '$or') {
    const compiled = args.map(compileNode);
    return (scope) => compiled.some((fn) => Boolean(fn(scope)));
  }
  if (op === '$not') {
    const inner = compileNode(args[0]!);
    return (scope) => !inner(scope);
  }
  if (op === '$in') return compileIn(args);
  if (op === '$nin') return compileNin(args);
  if (op === '$regex') return compileRegex(args);
  if (op === '$exists') return compileExists(args);
  if (op === '$elemMatch') return compileElemMatch(args);

  throw new PredicateError('PREDICATE_UNKNOWN_OPERATOR', `Unknown operator: ${op}`);
}

// ---------------------------------------------------------------------------
// Node dispatch
// ---------------------------------------------------------------------------

function compileNode(node: ExprNode): ScopeFn {
  switch (node.kind) {
    case 'literal': return compileLiteral(node);
    case 'path': return compilePath(node);
    case 'op': return compileOp(node);
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
export function compileFilter(query: ShorthandQuery): FilterFn {
  const ast = compileShorthand(query);
  return compileFilterFromAst(ast);
}

/** Compile an existing AST to an optimized native filter function. */
export function compileFilterFromAst(ast: ExprNode): FilterFn {
  const inner = compileNode(ast);
  return (doc) => Boolean(inner(doc as Record<string, unknown>));
}
