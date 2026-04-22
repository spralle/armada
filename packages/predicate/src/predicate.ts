import type { Query } from './compile.js';
import type { FilterFn } from './filter-compiler.js';
import { compileFilter } from './filter-compiler.js';
import { PredicateError } from './errors.js';
import { getNestedValue } from './path-utils.js';

function compareValues(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  if (a === undefined && b !== undefined) return -1;
  if (a !== undefined && b === undefined) return 1;
  return 0;
}

function applySorting<T>(items: T[], sortSpec: Record<string, 1 | -1>): T[] {
  const entries = Object.entries(sortSpec);
  return items.sort((a, b) => {
    for (const [field, dir] of entries) {
      const va = getNestedValue(a, field);
      const vb = getNestedValue(b, field);
      const cmp = compareValues(va, vb) * dir;
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

export class Predicate<T = Record<string, unknown>> {
  private readonly _filter: FilterFn;
  private _skip?: number;
  private _limit?: number;
  private _sort?: Record<string, 1 | -1>;

  constructor(query: Query) {
    this._filter = compileFilter(query);
  }

  skip(count: number): this {
    this._skip = count;
    return this;
  }

  limit(count: number): this {
    this._limit = count;
    return this;
  }

  sort(spec: Record<string, 1 | -1>): this {
    this._sort = spec;
    return this;
  }

  /** Test a single document against the query. */
  test(doc: T): boolean {
    return this._filter(doc as unknown as Record<string, unknown>);
  }

  /** Find all matching documents with optional sort/skip/limit. */
  find(collection: readonly T[]): readonly T[] {
    let results = collection.filter(
      (item) => this._filter(item as unknown as Record<string, unknown>),
    );

    if (this._sort) {
      results = applySorting(results, this._sort);
    }

    const skip = this._skip ?? 0;
    const limit = this._limit;

    if (skip > 0 || limit !== undefined) {
      results = results.slice(skip, limit !== undefined ? skip + limit : undefined);
    }

    return results;
  }

  /** Find exactly one matching document. Throws if count !== 1 (kuery-compatible). */
  findOne(collection: readonly T[]): T {
    const results = this.find(collection);
    if (results.length !== 1) {
      throw new PredicateError(
        'PREDICATE_FIND_ONE',
        `findOne returned ${String(results.length)} results`,
      );
    }
    return results[0]!;
  }
}
