import type { Query } from '../compile.js';
import { compileFilter } from '../filter-compiler.js';
import { validateAndSplitPath, resolveSegments } from '../path-utils.js';

export interface FindOptions {
  readonly skip?: number;
  readonly limit?: number;
  readonly sort?: Record<string, 1 | -1>;
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  if (a === undefined && b !== undefined) return -1;
  if (a !== undefined && b === undefined) return 1;
  return 0;
}

function applySorting<T>(items: readonly T[], sort: Record<string, 1 | -1>): readonly T[] {
  const fields = Object.entries(sort).map(([field, dir]) => ({
    segments: validateAndSplitPath(field),
    dir,
  }));
  if (fields.length === 0) return items;

  const sorted = [...items];
  sorted.sort((a, b) => {
    for (const { segments, dir } of fields) {
      const va = resolveSegments(a, segments);
      const vb = resolveSegments(b, segments);
      const cmp = compareValues(va, vb) * dir;
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  return sorted;
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
    results = applySorting(results, options.sort) as T[];
  }

  if (skip > 0 || limit !== undefined) {
    results = results.slice(skip, limit !== undefined ? skip + limit : undefined) as T[];
  }

  return results;
}
