import type { ExprNode, EvaluationScope } from './ast.js';
import { PredicateError } from './errors.js';
import { resolvePath } from './path-utils.js';
import { compileRawFromAst, clearRegexCache, getRegexCacheSize } from './filter-compiler.js';
import type { OperatorRegistry } from './operators.js';

export { clearRegexCache, getRegexCacheSize };
export type { EvaluationScope } from './ast.js';

const DEFAULT_MAX_DEPTH = 256;

export interface EvaluateOptions {
  readonly maxDepth?: number;
  readonly operators?: OperatorRegistry;
}

/** Count the maximum nesting depth of op nodes in an AST. */
function astDepth(node: ExprNode): number {
  if (node.kind !== 'op') return 0;
  let max = 0;
  for (const arg of node.args) {
    const d = astDepth(arg);
    if (d > max) max = d;
  }
  return max + 1;
}

export function evaluate(
  node: ExprNode,
  scope: EvaluationScope,
  options?: EvaluateOptions,
): unknown {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;

  switch (node.kind) {
    case 'literal': return node.value;
    case 'path': return resolvePath(node.path, scope as Record<string, unknown>);
    case 'op': {
      if (astDepth(node) > maxDepth) {
        throw new PredicateError(
          'PREDICATE_DEPTH_EXCEEDED',
          `Expression evaluation exceeded maximum depth of ${String(maxDepth)}`,
        );
      }
      const raw = compileRawFromAst(node, { registry: options?.operators });
      return raw(scope as Record<string, unknown>);
    }
  }
}
