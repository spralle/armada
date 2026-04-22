import type { ExprNode, EvaluationScope } from './ast.js';
import { evaluate } from './evaluator.js';
import { resolvePath } from './path-utils.js';
import { COMPARISON_OPS } from './compile.js';

/** A single trace entry describing why a predicate comparison failed. */
export interface PredicateFailureTrace {
  readonly path: string;
  readonly operator: string;
  readonly expected: unknown;
  readonly actual: unknown;
}

/** Result of evaluating an expression with failure tracing enabled. */
export interface EvaluateWithTraceResult {
  readonly result: unknown;
  readonly traces: readonly PredicateFailureTrace[];
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

/** Evaluate an expression and collect traces for any failed comparisons. */
export function evaluateWithTrace(
  node: ExprNode,
  scope: EvaluationScope,
): EvaluateWithTraceResult {
  const result = evaluate(node, scope);
  const traces: PredicateFailureTrace[] = [];
  collectTraces(node, scope, traces);
  return { result, traces };
}
