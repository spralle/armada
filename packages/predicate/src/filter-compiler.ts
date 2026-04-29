import type { ExprNode } from "./ast.js";
import { compile, type Query } from "./compile.js";
import { PredicateError } from "./errors.js";
import {
  type BoolScopeFn,
  compileAll,
  compileComparison,
  compileElemMatch,
  compileExists,
  compileInclusion,
  compileRegex,
  compileSize,
  setCompilerFns,
  type ValScopeFn,
} from "./filter-operators.js";
import type { OperatorRegistry } from "./operators.js";
import { collectPath, PATH_MISSING, validateAndSplitPath } from "./path-utils.js";
import { clearRegexCache, getRegexCacheSize } from "./regex-cache.js";
import type { TypedQuery } from "./typed-query.js";

export { clearRegexCache, getRegexCacheSize };

/** Predicate function that tests a document against a compiled query. */
export type FilterFn<T = Record<string, unknown>> = (doc: Readonly<T>) => boolean;

/** Options for compiling a filter from a query or AST. */
export interface CompileFilterOptions {
  readonly registry?: OperatorRegistry;
  readonly maxDepth?: number;
}

function compilePath(node: ExprNode & { kind: "path" }): ValScopeFn {
  const segments = validateAndSplitPath(node.path);
  if (segments.length === 1) {
    const key = segments[0]!;
    return (scope) => scope[key];
  }
  return (scope) => collectPath(scope, segments);
}

function compilePathWithMissing(node: ExprNode & { kind: "path" }): ValScopeFn {
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
function compileLiteral(node: ExprNode & { kind: "literal" }): ValScopeFn {
  const val = node.value;
  return () => val;
}

// ---------------------------------------------------------------------------
// Op dispatch
// ---------------------------------------------------------------------------
function compileOp(node: ExprNode & { kind: "op" }, registry?: OperatorRegistry): BoolScopeFn | ValScopeFn {
  const { op, args } = node;

  if (op === "$eq" || op === "$ne" || op === "$gt" || op === "$gte" || op === "$lt" || op === "$lte") {
    return compileComparison(op, args);
  }
  if (op === "$and") {
    const compiled = args.map((a) => compileNode(a, registry));
    return (scope) => compiled.every((fn) => Boolean(fn(scope)));
  }
  if (op === "$or") {
    const compiled = args.map((a) => compileNode(a, registry));
    return (scope) => compiled.some((fn) => Boolean(fn(scope)));
  }
  if (op === "$not") {
    const inner = compileNode(args[0]!, registry);
    return (scope) => !inner(scope);
  }
  if (op === "$in") return compileInclusion(args, false);
  if (op === "$nin") return compileInclusion(args, true);
  if (op === "$regex") return compileRegex(args);
  if (op === "$exists") return compileExists(args);
  if (op === "$elemMatch") return compileElemMatch(args, registry);
  if (op === "$all") return compileAll(args);
  if (op === "$size") return compileSize(args);

  if (registry) {
    const handler = registry.getHandler(op);
    if (handler) {
      const compiledArgs = args.map((a) => compileNode(a, registry));
      return (scope) =>
        handler(
          compiledArgs.map((fn) => fn(scope)),
          scope,
        );
    }
  }

  throw new PredicateError("PREDICATE_UNKNOWN_OPERATOR", `Unknown operator: ${op}`);
}

// ---------------------------------------------------------------------------
// Node dispatch
// ---------------------------------------------------------------------------

function compileNode(node: ExprNode, registry?: OperatorRegistry): BoolScopeFn | ValScopeFn {
  switch (node.kind) {
    case "literal":
      return compileLiteral(node);
    case "path":
      return compilePath(node);
    case "op":
      return compileOp(node, registry);
  }
}

// Wire up the operator functions so they can call back into compileNode
setCompilerFns(compileNode, compilePathWithMissing, compilePath);

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
export function compileRawFromAst(
  ast: ExprNode,
  options?: CompileFilterOptions,
): (doc: Readonly<Record<string, unknown>>) => unknown {
  if (options?.maxDepth !== undefined) {
    assertAstDepth(ast, options.maxDepth);
  }
  return compileNode(ast, options?.registry);
}

// ---------------------------------------------------------------------------
// AST depth validation
// ---------------------------------------------------------------------------

function astDepth(node: ExprNode): number {
  if (node.kind !== "op") return 0;
  let max = 0;
  for (const arg of node.args) {
    const d = astDepth(arg);
    if (d > max) max = d;
  }
  return max + 1;
}

function assertAstDepth(node: ExprNode, maxDepth: number): void {
  if (astDepth(node) > maxDepth) {
    throw new PredicateError("PREDICATE_DEPTH_EXCEEDED", `Expression exceeded maximum depth of ${String(maxDepth)}`);
  }
}
