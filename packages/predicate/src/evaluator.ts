import type { ExprNode, EvaluationScope } from './ast.js';
import { resolvePath } from './path-utils.js';
import { compileRawFromAst } from './filter-compiler.js';
import { clearRegexCache, getRegexCacheSize } from './regex-cache.js';
import type { OperatorRegistry } from './operators.js';

export { clearRegexCache, getRegexCacheSize };
export type { EvaluationScope } from './ast.js';

const DEFAULT_MAX_DEPTH = 256;

export interface EvaluateOptions {
  readonly maxDepth?: number;
  readonly operators?: OperatorRegistry;
}

export function evaluate(
  node: ExprNode,
  scope: EvaluationScope,
  options?: EvaluateOptions,
): unknown {
  switch (node.kind) {
    case 'literal': return node.value;
    case 'path': return resolvePath(node.path, scope as Record<string, unknown>);
    case 'op': {
      const raw = compileRawFromAst(node, {
        registry: options?.operators,
        maxDepth: options?.maxDepth ?? DEFAULT_MAX_DEPTH,
      });
      return raw(scope as Record<string, unknown>);
    }
  }
}
