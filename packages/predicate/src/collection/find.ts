import type { Query } from '../compile.js';
import { compileFilter } from '../filter-compiler.js';
import { applySorting } from '../sort-utils.js';

export interface FindOptions {
  readonly skip?: number;
  readonly limit?: number;
  readonly sort?: Record<string, 1 | -1>;
}

export function find<T>(
  collection: readonly T[],
  query: Query,
  options?: FindOptions,
): readonly T[] {
  const filter = compileFilter(query);
  const skip = options?.skip ?? 0;
  const limit = options?.limit;

  // Fast path: no sort + has limit — avoid full collection scan
  if (!options?.sort && limit !== undefined) {
    const results: T[] = [];
    let skipped = 0;
    for (const item of collection) {
      if (filter(item as unknown as Record<string, unknown>)) {
        if (skipped < skip) { skipped++; continue; }
        results.push(item);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  let results = collection.filter((item) => {
    return filter(item as unknown as Record<string, unknown>);
  });

  if (options?.sort) {
    results = applySorting(results, options.sort);
  }

  if (skip > 0 || limit !== undefined) {
    results = results.slice(skip, limit !== undefined ? skip + limit : undefined) as T[];
  }

  return results;
}
