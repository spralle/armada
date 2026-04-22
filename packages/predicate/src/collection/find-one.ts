import type { Query } from '../compile.js';
import type { TypedQuery } from '../typed-query.js';
import type { CompileFilterOptions, FilterFn } from '../filter-compiler.js';
import { compileFilter } from '../filter-compiler.js';

/** Find the first document in a collection matching a query, or undefined if none match. */
export function findOne<T>(collection: readonly T[], query: TypedQuery<T>, options?: CompileFilterOptions): T | undefined;
export function findOne<T>(collection: readonly T[], query: Query, options?: CompileFilterOptions): T | undefined;
export function findOne<T>(collection: readonly T[], query: Query, options?: CompileFilterOptions): T | undefined {
  const filter = compileFilter(query, options) as FilterFn<T>;
  for (const item of collection) {
    if (filter(item)) {
      return item;
    }
  }
  return undefined;
}
