import { compile, type Query } from '../compile.js';
import { evaluate } from '../evaluator.js';
import type { EvaluationScope } from '../ast.js';

export function findOne<T>(collection: readonly T[], query: Query): T | undefined {
  const ast = compile(query);

  for (const item of collection) {
    const scope = item as unknown as EvaluationScope;
    if (Boolean(evaluate(ast, scope))) {
      return item;
    }
  }

  return undefined;
}
