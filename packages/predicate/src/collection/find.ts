import { compileShorthand, type ShorthandQuery } from '../shorthand.js';
import { evaluate } from '../evaluator.js';
import type { EvaluationScope } from '../ast.js';

export interface FindOptions {
  readonly skip?: number;
  readonly limit?: number;
  readonly sort?: Record<string, 1 | -1>;
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  if (a === undefined && b !== undefined) return -1;
  if (a !== undefined && b === undefined) return 1;
  return 0;
}

function getNestedValue(obj: unknown, path: string): unknown {
  let current: unknown = obj;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function applySorting<T>(items: readonly T[], sort: Record<string, 1 | -1>): readonly T[] {
  const entries = Object.entries(sort);
  if (entries.length === 0) return items;

  const sorted = [...items];
  sorted.sort((a, b) => {
    for (const [field, direction] of entries) {
      const va = getNestedValue(a, field);
      const vb = getNestedValue(b, field);
      const cmp = compareValues(va, vb) * direction;
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  return sorted;
}

export function find<T>(
  collection: readonly T[],
  query: ShorthandQuery,
  options?: FindOptions,
): readonly T[] {
  const ast = compileShorthand(query);

  let results = collection.filter((item) => {
    const scope = item as unknown as EvaluationScope;
    return Boolean(evaluate(ast, scope));
  });

  if (options?.sort) {
    results = applySorting(results, options.sort) as T[];
  }

  const skip = options?.skip ?? 0;
  const limit = options?.limit;

  if (skip > 0 || limit !== undefined) {
    results = results.slice(skip, limit !== undefined ? skip + limit : undefined) as T[];
  }

  return results;
}
