import type { EvaluationScope, ExprNode } from "./ast.js";
import type { CompileFilterOptions } from "./filter-compiler.js";
import { compileRawFromAst } from "./filter-compiler.js";
import type { OperatorRegistry } from "./operators.js";
import { resolvePath } from "./path-utils.js";
import { clearRegexCache, getRegexCacheSize } from "./regex-cache.js";

export type { EvaluationScope } from "./ast.js";
export { clearRegexCache, getRegexCacheSize };

const DEFAULT_MAX_DEPTH = 256;

/** Options for expression evaluation. */
export interface EvaluateOptions {
  readonly maxDepth?: number;
  readonly operators?: OperatorRegistry;
}

/** Evaluate an expression AST against a scope, returning the computed value. */
export function evaluate(node: ExprNode, scope: EvaluationScope, options?: EvaluateOptions): unknown {
  switch (node.kind) {
    case "literal":
      return node.value;
    case "path":
      return resolvePath(node.path, scope as Record<string, unknown>);
    case "op": {
      const compileOpts: CompileFilterOptions = {
        maxDepth: options?.maxDepth ?? DEFAULT_MAX_DEPTH,
        ...(options?.operators ? { registry: options.operators } : {}),
      };
      const raw = compileRawFromAst(node, compileOpts);
      return raw(scope as Record<string, unknown>);
    }
  }
}
