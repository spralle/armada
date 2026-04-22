import type { Query } from '../compile.js';
import type { TypedQuery } from '../typed-query.js';
import type { CompileFilterOptions, FilterFn } from '../filter-compiler.js';
import { compileFilter } from '../filter-compiler.js';
import { applySorting } from '../sort-utils.js';

/** Options for the find() collection helper. */
export interface FindOptions {
  readonly skip?: number;
  readonly limit?: number;
  readonly sort?: Record<string, 1 | -1>;
  readonly registry?: CompileFilterOptions['registry'];
}

/** Find all documents in a collection matching a query, with optional sort/skip/limit. */
export function find<T>(collection: readonly T[], query: TypedQuery<T>, options?: FindOptions): readonly T[];
export function find<T>(collection: readonly T[], query: Query, options?: FindOptions): readonly T[];
export function find<T>(
  collection: readonly T[],
  query: Query,
  options?: FindOptions,
): readonly T[] {
  const filter = compileFilter(query, options?.registry ? { registry: options.registry } : undefined) as FilterFn<T>;
  const skip = options?.skip ?? 0;
  const limit = options?.limit;

  // Fast path: no sort + has limit — avoid full collection scan
  if (!options?.sort && limit !== undefined) {
    const results: T[] = [];
    let skipped = 0;
    for (const item of collection) {
      if (filter(item)) {
        if (skipped < skip) { skipped++; continue; }
        results.push(item);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  let results = collection.filter((item) => {
    return filter(item);
  });

  if (options?.sort) {
    results = applySorting(results, options.sort);
  }

  if (skip > 0 || limit !== undefined) {
    results = results.slice(skip, limit !== undefined ? skip + limit : undefined) as T[];
  }

  return results;
}
