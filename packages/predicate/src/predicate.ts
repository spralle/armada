import type { Query } from "./compile.js";
import { PredicateError } from "./errors.js";
import type { CompileFilterOptions, FilterFn } from "./filter-compiler.js";
import { compileFilter } from "./filter-compiler.js";
import { applySorting } from "./sort-utils.js";
import type { TypedQuery } from "./typed-query.js";

/** Options for constructing a Predicate instance. */
export interface PredicateOptions {
  readonly registry?: CompileFilterOptions["registry"];
}

/** Compiled query that can test documents and find matches in collections. */
export class Predicate<T = Record<string, unknown>> {
  private readonly _filter: FilterFn<T>;
  private _skip?: number;
  private _limit?: number;
  private _sort?: Record<string, 1 | -1>;

  constructor(query: TypedQuery<T>, options?: PredicateOptions);
  constructor(query: Query, options?: PredicateOptions);
  constructor(query: Query, options?: PredicateOptions) {
    // Safe: FilterFn only reads from doc, T extends object at runtime
    this._filter = compileFilter(query, options?.registry ? { registry: options.registry } : undefined) as FilterFn<T>;
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
    return this._filter(doc);
  }

  /** Find all matching documents with optional sort/skip/limit. */
  find(collection: readonly T[]): readonly T[] {
    const skip = this._skip ?? 0;
    const limit = this._limit;

    // Fast path: no sort + has limit — avoid full collection scan
    if (!this._sort && limit !== undefined) {
      const results: T[] = [];
      let skipped = 0;
      for (const item of collection) {
        if (this._filter(item)) {
          if (skipped < skip) {
            skipped++;
            continue;
          }
          results.push(item);
          if (results.length >= limit) break;
        }
      }
      return results;
    }

    let results = collection.filter((item) => this._filter(item));

    if (this._sort) {
      results = applySorting(results, this._sort);
    }

    if (skip > 0 || limit !== undefined) {
      results = results.slice(skip, limit !== undefined ? skip + limit : undefined);
    }

    return results;
  }

  /**
   * Find exactly one matching document. Throws if count !== 1 (kuery-compatible).
   * Ignores sort/skip/limit — findOne asserts uniqueness over the full collection.
   */
  findOne(collection: readonly T[]): T {
    let found: T | undefined;
    let count = 0;
    for (const item of collection) {
      if (this._filter(item)) {
        count++;
        if (count === 1) found = item;
        if (count > 1) break;
      }
    }
    if (count !== 1) {
      throw new PredicateError("PREDICATE_FIND_ONE", `findOne returned ${count === 0 ? "0" : "multiple"} results`);
    }
    return found!;
  }
}
