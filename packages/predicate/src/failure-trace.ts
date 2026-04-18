import type { ExprNode, EvaluationScope } from './ast.js';
import { evaluate } from './evaluator.js';

export interface PredicateFailureTrace {
  readonly path: string;
  readonly operator: string;
  readonly expected: unknown;
  readonly actual: unknown;
}

export interface EvaluateWithTraceResult {
  readonly result: unknown;
  readonly traces: readonly PredicateFailureTrace[];
}

const COMPARISON_OPS = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists', '$regex']);

function resolvePath(path: string, scope: EvaluationScope): unknown {
  let current: unknown = scope;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function collectTraces(
  node: ExprNode,
  scope: EvaluationScope,
  traces: PredicateFailureTrace[],
): void {
  if (node.kind === 'literal' || node.kind === 'path') return;

  const { op, args } = node;

  if (COMPARISON_OPS.has(op)) {
    const result = evaluate(node, scope);
    if (result === false) {
      const pathArg = args[0];
      const expectedArg = args[1];
      const path = pathArg.kind === 'path' ? pathArg.path : '<expr>';
      const actual = pathArg.kind === 'path' ? resolvePath(pathArg.path, scope) : evaluate(pathArg, scope);
      const expected = expectedArg ? evaluate(expectedArg, scope) : undefined;
      traces.push({ path, operator: op, expected, actual });
    }
    return;
  }

  if (op === '$and' || op === '$or') {
    for (const arg of args) {
      collectTraces(arg, scope, traces);
    }
    return;
  }

  if (op === '$not') {
    collectTraces(args[0], scope, traces);
  }
}

export function evaluateWithTrace(
  node: ExprNode,
  scope: EvaluationScope,
): EvaluateWithTraceResult {
  const result = evaluate(node, scope);
  const traces: PredicateFailureTrace[] = [];
  collectTraces(node, scope, traces);
  return { result, traces };
}
